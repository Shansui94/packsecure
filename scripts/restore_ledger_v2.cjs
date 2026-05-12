const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);

async function fixRestore() {
    console.log("CRITICAL EMERGENCY: Fetching valid locations...");
    
    const { data: locs, error: locErr } = await supabase
        .from('sys_locations_v2')
        .select('loc_id');
        
    if (locErr) {
        console.error("Failed to fetch locs", locErr);
        return;
    }
    
    const validLocs = new Set(locs.map(l => l.loc_id));
    console.log("Valid locs:", Array.from(validLocs));
    
    // 1. Get all Active Orders
    const { data: activeOrders, error: orderErr } = await supabase
        .from('sales_orders')
        .select('*')
        .neq('status', 'Cancelled')
        .neq('status', 'Unfulfilled');
        
    // 2. Get all surviving ledger entries
    const { data: survivingLedgers, error: ledgerErr } = await supabase
        .from('stock_ledger_v2')
        .select('ref_doc')
        .eq('event_type', 'Transfer Out');
        
    const survivingRefDocs = new Set(survivingLedgers.map(l => l.ref_doc));
    const missingOrders = activeOrders.filter(o => !survivingRefDocs.has(o.order_number) && o.items && o.items.length > 0);

    // 4. Construct Restoration Payloads
    const inserts = [];
    for (const order of missingOrders) {
        for (const item of order.items) {
            const sku = item.sku?.trim();
            const qty = Number(item.quantity);
            let loc = item.sourceLocation?.trim();
            
            // Fix invalid location
            if (!validLocs.has(loc)) {
                loc = 'OPM Lama'; // Fallback to main warehouse
            }
            
            if (sku && qty > 0) {
                inserts.push({
                    timestamp: order.created_at || order.order_date || new Date().toISOString(),
                    event_type: 'Transfer Out',
                    sku: sku,
                    change_qty: -qty,
                    loc_id: loc,
                    notes: 'Auto-deduct: RESTORED',
                    ref_doc: order.order_number
                });
            }
        }
    }
    
    console.log(`Ready to insert ${inserts.length} restored ledger lines.`);

    // 5. Insert in chunks of 500
    const chunkSize = 500;
    for (let i = 0; i < inserts.length; i += chunkSize) {
        const chunk = inserts.slice(i, i + chunkSize);
        console.log(`Inserting chunk ${i} to ${i + chunk.length}...`);
        const { error: insertErr } = await supabase.from('stock_ledger_v2').insert(chunk);
        if (insertErr) {
            console.error("Failed to insert chunk!", insertErr);
            return;
        }
    }
    
    console.log("✅ RESTORATION COMPLETE! Your stock balances should be back to normal.");
}

fixRestore();
