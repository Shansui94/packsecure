const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkRecentMerah() {
    const { data: currentStock } = await supabase
        .from('v2_inventory_view')
        .select('loc_id, current_stock')
        .eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED');
    
    console.log("Current Stock:", currentStock);

    const { data: logs } = await supabase
        .from('stock_ledger_v2')
        .select('timestamp, event_type, change_qty, loc_id, notes, ref_doc')
        .eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED')
        .eq('loc_id', 'OPM Lama')
        .gte('timestamp', '2026-04-25T00:00:00Z')
        .order('timestamp', { ascending: true });
        
    let summary = {};
    let totalChanges = 0;
    
    if (logs) {
        logs.forEach(log => {
            totalChanges += log.change_qty;
            if (!summary[log.event_type]) summary[log.event_type] = { count: 0, sum: 0 };
            summary[log.event_type].count++;
            summary[log.event_type].sum += log.change_qty;
        });
    }
    
    console.log(`\nTotal Changes since Apr 25: ${totalChanges}`);
    console.log("Summary of events since Apr 25:");
    console.table(summary);
    
    console.log("\nTop 5 Largest Transfer Out since Apr 25:");
    const outs = logs?.filter(l => l.event_type === 'Transfer Out').sort((a,b) => a.change_qty - b.change_qty).slice(0, 5) || [];
    outs.forEach(o => console.log(`${o.timestamp} | ${o.change_qty} | ${o.ref_doc}`));
    
    console.log("\nTop 5 Largest Production since Apr 25:");
    const prods = logs?.filter(l => l.event_type === 'Production').sort((a,b) => b.change_qty - a.change_qty).slice(0, 5) || [];
    prods.forEach(p => console.log(`${p.timestamp} | ${p.change_qty} | ${p.ref_doc}`));
}

checkRecentMerah();
