const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function deepDiveMerah() {
    console.log("Deep Dive MERAH in OPM Lama since April 23 Audit...");
    const { data: logs, error } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED')
        .eq('loc_id', 'OPM Lama')
        .gt('timestamp', '2026-04-23T16:39:32+00:00') // Time of audit
        .order('timestamp', { ascending: true });
        
    if (error) {
        console.error(error);
        return;
    }
    
    let runningTotal = 22; // The audit set it to 22
    let summary = {};
    
    logs.forEach(log => {
        runningTotal += log.change_qty;
        if (!summary[log.event_type]) summary[log.event_type] = { count: 0, sum: 0 };
        summary[log.event_type].count++;
        summary[log.event_type].sum += log.change_qty;
    });
    
    console.log("Summary of all events since Audit:");
    console.table(summary);
    
    console.log(`Starting Base (from Audit): 22`);
    console.log(`Calculated Current Stock: ${runningTotal}`);
    
    // Check if there are any giant Transfer Out or something weird
    // Also, 546 Production? Is that realistic?
    console.log("\nTop 5 biggest positive changes:");
    logs.sort((a,b) => b.change_qty - a.change_qty);
    console.log(logs.slice(0, 5).map(l => `${l.event_type} | ${l.change_qty} | ${l.ref_doc}`));
    
    console.log("\nTop 5 biggest negative changes:");
    logs.sort((a,b) => a.change_qty - b.change_qty);
    console.log(logs.slice(0, 5).map(l => `${l.event_type} | ${l.change_qty} | ${l.ref_doc}`));
}

deepDiveMerah();
