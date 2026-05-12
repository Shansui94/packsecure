const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkRecentMerahAccurate() {
    const { data: logs } = await supabase
        .from('stock_ledger_v2')
        .select('timestamp, event_type, change_qty, loc_id, notes, ref_doc')
        .eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED')
        .eq('loc_id', 'OPM Lama')
        .gt('timestamp', '2026-04-25T06:36:00Z')
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
    
    console.log(`Starting stock on Apr 25 06:36Z: 68`);
    console.log(`Total Changes since Apr 25 06:36Z: ${totalChanges}`);
    console.log(`Expected Current Stock: ${68 + totalChanges}`);
    console.log("Summary of events since Apr 25 06:36Z:");
    console.table(summary);
    
    console.log("\nDetails of changes:");
    logs.forEach(o => console.log(`${o.timestamp} | ${o.event_type} | ${o.change_qty} | ${o.ref_doc || o.notes}`));
}

checkRecentMerahAccurate();
