const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function cleanupGhostRecordsPaginated() {
    console.log("Starting full paginated cleanup of all ghost records...");
    
    let allCreatedLogs = [];
    let page = 0;
    
    while(true) {
        const { data: createdLogs, error: clErr } = await supabase
            .from('stock_ledger_v2')
            .select('txn_id, ref_doc, notes')
            .like('notes', '%Order Created%')
            .range(page * 1000, (page + 1) * 1000 - 1);
            
        if (clErr) throw clErr;
        if (!createdLogs || createdLogs.length === 0) break;
        
        allCreatedLogs = allCreatedLogs.concat(createdLogs);
        page++;
    }
    
    console.log(`Fetched ${allCreatedLogs.length} total ghost records.`);
    if (allCreatedLogs.length === 0) return;
    
    const orderNumbers = [...new Set(allCreatedLogs.map(l => l.ref_doc))];
    
    let salesOrders = [];
    // Fetch in chunks of 100 to avoid URL length limits
    for (let i = 0; i < orderNumbers.length; i += 100) {
        const chunk = orderNumbers.slice(i, i + 100);
        const { data: so } = await supabase
            .from('sales_orders')
            .select('order_number, status')
            .in('order_number', chunk);
        salesOrders = salesOrders.concat(so || []);
    }
    
    const statusMap = {};
    salesOrders.forEach(o => statusMap[o.order_number] = o.status);
    
    const deliveredOrders = salesOrders.filter(o => o.status === 'Delivered').map(o => o.order_number);
    let doubleDeducted = new Set();
    
    for (let i = 0; i < deliveredOrders.length; i += 100) {
        const chunk = deliveredOrders.slice(i, i + 100);
        const { data: deliveredLogs } = await supabase
            .from('stock_ledger_v2')
            .select('ref_doc')
            .in('ref_doc', chunk)
            .like('notes', '%Order Delivered%');
        deliveredLogs?.forEach(l => doubleDeducted.add(l.ref_doc));
    }
    
    const txnIdsToDelete = [];
    allCreatedLogs.forEach(log => {
        const status = statusMap[log.ref_doc];
        if (!status || status !== 'Delivered' || (status === 'Delivered' && doubleDeducted.has(log.ref_doc))) {
            txnIdsToDelete.push(log.txn_id);
        }
    });
    
    console.log(`Will delete ${txnIdsToDelete.length} ghost records.`);
    
    for (let i = 0; i < txnIdsToDelete.length; i += 100) {
        const chunk = txnIdsToDelete.slice(i, i + 100);
        await supabase.from('stock_ledger_v2').delete().in('txn_id', chunk);
    }
    
    console.log("✅ Successfully purged all remaining ghost records!");
}

cleanupGhostRecordsPaginated();
