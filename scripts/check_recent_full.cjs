const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkRecentFull() {
    let allLedger = [];
    let page = 0;
    while(true) {
        const { data } = await supabase
            .from('stock_ledger_v2')
            .select('timestamp, event_type, change_qty, loc_id, notes, ref_doc')
            .eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED')
            .eq('loc_id', 'OPM Lama')
            .gte('timestamp', '2026-04-25T00:00:00Z')
            .order('timestamp', { ascending: true })
            .range(page * 1000, (page + 1) * 1000 - 1);
        if (!data || data.length === 0) break;
        allLedger = allLedger.concat(data);
        page++;
    }
    
    let summary = {};
    let totalChanges = 0;
    
    allLedger.forEach(log => {
        totalChanges += log.change_qty;
        if (!summary[log.event_type]) summary[log.event_type] = { count: 0, sum: 0 };
        summary[log.event_type].count++;
        summary[log.event_type].sum += log.change_qty;
    });
    
    console.log(`Total rows fetched: ${allLedger.length}`);
    console.log(`Total Changes since Apr 25: ${totalChanges}`);
    console.log("Summary of events since Apr 25:");
    console.table(summary);
}

checkRecentFull();
