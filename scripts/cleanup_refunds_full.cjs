const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function cleanupOrphanRefundsPaginated() {
    console.log("Starting full paginated cleanup of orphaned refunds...");
    
    let allRefunds = [];
    let page = 0;
    
    while(true) {
        const { data: refunds, error } = await supabase
            .from('stock_ledger_v2')
            .select('txn_id, ref_doc')
            .eq('event_type', 'Cancellation Refund')
            .range(page * 1000, (page + 1) * 1000 - 1);
            
        if (error) throw error;
        if (!refunds || refunds.length === 0) break;
        
        allRefunds = allRefunds.concat(refunds);
        page++;
    }
    
    console.log(`Fetched ${allRefunds.length} total Cancellation Refunds.`);
    if (allRefunds.length === 0) return;
    
    const orderNumbers = [...new Set(allRefunds.map(l => l.ref_doc))];
    let allTransferOuts = [];
    
    for (let i = 0; i < orderNumbers.length; i += 100) {
        const chunk = orderNumbers.slice(i, i + 100);
        const { data: outs } = await supabase
            .from('stock_ledger_v2')
            .select('ref_doc')
            .eq('event_type', 'Transfer Out')
            .in('ref_doc', chunk);
        allTransferOuts = allTransferOuts.concat(outs || []);
    }
    
    const validRefs = new Set(allTransferOuts.map(l => l.ref_doc));
    
    const txnIdsToDelete = [];
    allRefunds.forEach(log => {
        if (!validRefs.has(log.ref_doc)) {
            txnIdsToDelete.push(log.txn_id);
        }
    });
    
    console.log(`Will delete ${txnIdsToDelete.length} orphaned refunds.`);
    
    for (let i = 0; i < txnIdsToDelete.length; i += 100) {
        const chunk = txnIdsToDelete.slice(i, i + 100);
        await supabase.from('stock_ledger_v2').delete().in('txn_id', chunk);
    }
    
    console.log("✅ Successfully purged all orphaned refunds!");
}

cleanupOrphanRefundsPaginated();
