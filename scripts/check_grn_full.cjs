const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkGrnFull() {
    let allLedger = [];
    let page = 0;
    while(true) {
        const { data } = await supabase
            .from('stock_ledger_v2')
            .select('timestamp, event_type, change_qty, loc_id, notes, ref_doc')
            .eq('sku', 'BW-SL-CLR-100Mx25CMx4ROLL-GRN')
            .range(page * 1000, (page + 1) * 1000 - 1);
        if (!data || data.length === 0) break;
        allLedger = allLedger.concat(data);
        page++;
    }
    
    let summary = {};
    let sumMap = {};
    
    allLedger.forEach(log => {
        const loc = log.loc_id || 'null';
        if (!sumMap[loc]) sumMap[loc] = 0;
        sumMap[loc] += log.change_qty;
        
        const key = `${loc} | ${log.event_type}`;
        if (!summary[key]) summary[key] = { count: 0, sum: 0 };
        summary[key].count++;
        summary[key].sum += log.change_qty;
    });
    
    console.log("Full Raw Sums by Location:", sumMap);
    console.log("Summary by Location & Event Type:");
    console.table(summary);
}

checkGrnFull();
