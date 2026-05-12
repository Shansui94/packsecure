const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkOldOrders() {
    console.log("Checking all 'Order Created' ghost records...");
    
    // Get the ledger entries
    const { data: ledgerEntries, error } = await supabase
        .from('stock_ledger_v2')
        .select('ref_doc, timestamp, sku, change_qty')
        .like('notes', '%Order Created%');
        
    if (error) {
        console.error("Error:", error);
        return;
    }
    
    // Group by ref_doc (Order Number)
    const orderMap = {};
    ledgerEntries.forEach(entry => {
        if (!orderMap[entry.ref_doc]) {
            orderMap[entry.ref_doc] = {
                orderNumber: entry.ref_doc,
                timestamp: entry.timestamp,
                itemCount: 0
            };
        }
        orderMap[entry.ref_doc].itemCount++;
    });
    
    const orderNumbers = Object.keys(orderMap);
    console.log(`Found ${orderNumbers.length} distinct orders with premature deductions.`);
    
    // Fetch their real status from sales_orders
    const { data: salesOrders, error: soError } = await supabase
        .from('sales_orders')
        .select('order_number, status')
        .in('order_number', orderNumbers);
        
    if (soError) {
        console.error("SO Error:", soError);
        return;
    }
    
    const statusCount = { 'Delivered': 0, 'New': 0, 'Pending Approval': 0, 'Cancelled': 0, 'Ready': 0, 'Missing': 0 };
    const missing = [];
    
    const soStatusMap = {};
    salesOrders.forEach(o => soStatusMap[o.order_number] = o.status);
    
    orderNumbers.forEach(onum => {
        const stat = soStatusMap[onum];
        if (stat) {
            if (statusCount[stat] === undefined) statusCount[stat] = 0;
            statusCount[stat]++;
        } else {
            statusCount['Missing']++;
            missing.push(onum);
        }
    });
    
    console.log("Status Breakdown of these old orders:", statusCount);
    
    // List the future ones (not delivered yet)
    const pendingOrders = salesOrders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').map(o => o.order_number);
    console.log("Orders that are NOT YET delivered (Ghost Deductions):", pendingOrders);
}

checkOldOrders();
