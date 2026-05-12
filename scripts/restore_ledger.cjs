const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);

async function restoreDisaster() {
    console.log("CRITICAL EMERGENCY: Starting ledger restoration...");
    
    // 1. Get all Active Orders
    const { data: activeOrders, error: orderErr } = await supabase
        .from('sales_orders')
        .select('*')
        .neq('status', 'Cancelled')
        .neq('status', 'Unfulfilled');
        
    if (orderErr) {
        console.error("Failed to fetch orders", orderErr);
        return;
    }
    
    console.log(`Found ${activeOrders.length} active orders.`);

    // 2. Get all surviving ledger entries (to avoid double deducting)
    // We only care about Transfer Out
    const { data: survivingLedgers, error: ledgerErr } = await supabase
        .from('stock_ledger_v2')
        .select('ref_doc')
        .eq('event_type', 'Transfer Out');
        
    if (ledgerErr) {
        console.error("Failed to fetch surviving ledger", ledgerErr);
        return;
    }
    
    const survivingRefDocs = new Set(survivingLedgers.map(l => l.ref_doc));
    console.log(`Found ${survivingRefDocs.size} orders that still have ledger entries.`);

    // 3. Find missing orders
    const missingOrders = activeOrders.filter(o => !survivingRefDocs.has(o.order_number) && o.items && o.items.length > 0);
    console.log(`Need to restore ledger for ${missingOrders.length} orders!`);

    if (missingOrders.length === 0) {
        console.log("Nothing to restore.");
        return;
    }

    // 4. Construct Restoration Payloads
    const inserts = [];
    for (const order of missingOrders) {
        for (const item of order.items) {
            const sku = item.sku?.trim();
            const qty = Number(item.quantity);
            let loc = item.sourceLocation?.trim();
            if (!loc) loc = 'no location';
            
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

    // 5. Insert in chunks of 500 to prevent timeout
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

restoreDisaster();
