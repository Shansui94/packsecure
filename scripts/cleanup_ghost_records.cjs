const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function cleanupGhostRecords() {
    console.log("Starting precision cleanup of ghost records...");
    
    // 1. Get all ledger entries with 'Order Created'
    const { data: createdLogs, error: clErr } = await supabase
        .from('stock_ledger_v2')
        .select('txn_id, ref_doc, notes')
        .like('notes', '%Order Created%');
        
    if (clErr) {
        console.error("Failed to fetch Order Created logs:", clErr);
        return;
    }
    
    // Get unique order numbers
    const orderNumbers = [...new Set(createdLogs.map(l => l.ref_doc))];
    
    // 2. Fetch current status of these orders
    const { data: salesOrders, error: soErr } = await supabase
        .from('sales_orders')
        .select('order_number, status')
        .in('order_number', orderNumbers);
        
    if (soErr) {
        console.error("Failed to fetch sales orders:", soErr);
        return;
    }
    
    const statusMap = {};
    salesOrders.forEach(o => statusMap[o.order_number] = o.status);
    
    // 3. Find which Delivered orders have BOTH Created and Delivered logs
    const deliveredOrders = salesOrders.filter(o => o.status === 'Delivered').map(o => o.order_number);
    let doubleDeducted = new Set();
    
    if (deliveredOrders.length > 0) {
        const { data: deliveredLogs } = await supabase
            .from('stock_ledger_v2')
            .select('ref_doc')
            .in('ref_doc', deliveredOrders)
            .like('notes', '%Order Delivered%');
            
        deliveredLogs.forEach(l => doubleDeducted.add(l.ref_doc));
    }
    
    // 4. Decide which txn_ids to delete
    const txnIdsToDelete = [];
    let countNew = 0;
    let countCancelled = 0;
    let countDouble = 0;
    
    createdLogs.forEach(log => {
        const status = statusMap[log.ref_doc];
        
        if (!status) {
            // Missing order, maybe it was deleted entirely. Safe to remove ghost log.
            txnIdsToDelete.push(log.txn_id);
        } else if (status !== 'Delivered') {
            // New, Ready, Pending Approval, Cancelled -> NOT DELIVERED YET (or Cancelled)
            txnIdsToDelete.push(log.txn_id);
            if (status === 'Cancelled') countCancelled++;
            else countNew++;
        } else if (status === 'Delivered' && doubleDeducted.has(log.ref_doc)) {
            // Delivered BUT has double deduction
            txnIdsToDelete.push(log.txn_id);
            countDouble++;
        }
        // If Delivered and NOT double deducted, keep it! (It's an old order)
    });
    
    console.log(`Identified ${txnIdsToDelete.length} specific ghost transaction rows to delete.`);
    console.log(`- From Undelivered Orders: ~${countNew} rows`);
    console.log(`- From Cancelled Orders: ~${countCancelled} rows`);
    console.log(`- From Double Deducted: ~${countDouble} rows`);
    
    // 5. Execute Deletion
    if (txnIdsToDelete.length > 0) {
        // Supabase allows deleting by 'in' but there might be a URL length limit if it's too big.
        // Since it's < 100 IDs, it should be fine.
        const { error: delErr } = await supabase
            .from('stock_ledger_v2')
            .delete()
            .in('txn_id', txnIdsToDelete);
            
        if (delErr) {
            console.error("Deletion Error:", delErr);
        } else {
            console.log("✅ Successfully purged ghost records!");
        }
    } else {
        console.log("No ghost records needed to be deleted.");
    }
}

cleanupGhostRecords();
