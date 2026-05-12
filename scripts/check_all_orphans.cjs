const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkAllOrphans() {
    console.log("Checking for ANY remaining orphaned refunds system-wide...");
    
    // Fetch all refunds using pagination to bypass 1000 limit
    let allRefunds = [];
    let page = 0;
    while(true) {
        const { data } = await supabase
            .from('stock_ledger_v2')
            .select('txn_id, ref_doc')
            .eq('event_type', 'Cancellation Refund')
            .range(page * 1000, (page + 1) * 1000 - 1);
        if (!data || data.length === 0) break;
        allRefunds = allRefunds.concat(data);
        page++;
    }
    
    console.log(`Total Cancellation Refunds in DB: ${allRefunds.length}`);
    
    const refDocs = [...new Set(allRefunds.map(r => r.ref_doc))];
    
    // Fetch outs in chunks
    let allOuts = new Set();
    for (let i = 0; i < refDocs.length; i += 500) {
        const chunk = refDocs.slice(i, i + 500);
        const { data: outs } = await supabase
            .from('stock_ledger_v2')
            .select('ref_doc')
            .in('ref_doc', chunk)
            .eq('event_type', 'Transfer Out');
        if (outs) outs.forEach(o => allOuts.add(o.ref_doc));
    }
    
    const orphans = allRefunds.filter(r => !allOuts.has(r.ref_doc));
    console.log(`Found ${orphans.length} remaining orphaned refunds.`);
    
    if (orphans.length > 0) {
        console.log("Deleting remaining orphans...");
        const txnIds = orphans.map(o => o.txn_id);
        // delete in chunks
        for (let i = 0; i < txnIds.length; i += 100) {
            const chunk = txnIds.slice(i, i + 100);
            await supabase.from('stock_ledger_v2').delete().in('txn_id', chunk);
        }
        console.log("Cleaned up remaining orphans.");
    }
}

checkAllOrphans();
