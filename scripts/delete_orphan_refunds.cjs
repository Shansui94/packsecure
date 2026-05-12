const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function deleteOrphanRefunds() {
    console.log("Deleting orphaned refunds...");
    // Find all refunds
    const { data: refunds } = await supabase
        .from('stock_ledger_v2')
        .select('txn_id, ref_doc')
        .eq('event_type', 'Cancellation Refund');
        
    // Find all deductions (Transfer Out) for the same ref_doc
    const refDocs = [...new Set(refunds.map(r => r.ref_doc))];
    
    const { data: outs } = await supabase
        .from('stock_ledger_v2')
        .select('ref_doc')
        .in('ref_doc', refDocs)
        .eq('event_type', 'Transfer Out');
        
    const outDocs = new Set(outs.map(o => o.ref_doc));
    
    const orphans = refunds.filter(r => !outDocs.has(r.ref_doc));
    
    if (orphans.length > 0) {
        const txnIds = orphans.map(o => o.txn_id);
        const { error } = await supabase
            .from('stock_ledger_v2')
            .delete()
            .in('txn_id', txnIds);
            
        console.log("Deleted", txnIds.length, "orphaned refunds!");
    } else {
        console.log("No orphans found.");
    }
}

deleteOrphanRefunds();
