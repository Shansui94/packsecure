const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkDouble() {
    const { data: salesOrders } = await supabase
        .from('sales_orders')
        .select('order_number, status');
        
    // Get ALL ledger entries for Delivered orders
    const { data: ledgerEntries } = await supabase
        .from('stock_ledger_v2')
        .select('ref_doc, notes, change_qty')
        .in('ref_doc', salesOrders.filter(o => o.status === 'Delivered').map(o => o.order_number));
        
    const orderMap = {};
    ledgerEntries.forEach(entry => {
        if (!orderMap[entry.ref_doc]) orderMap[entry.ref_doc] = { hasCreated: false, hasDelivered: false };
        if (entry.notes && entry.notes.includes('Order Created')) orderMap[entry.ref_doc].hasCreated = true;
        if (entry.notes && entry.notes.includes('Order Delivered')) orderMap[entry.ref_doc].hasDelivered = true;
    });
    
    let doubleDeducted = [];
    Object.keys(orderMap).forEach(key => {
        if (orderMap[key].hasCreated && orderMap[key].hasDelivered) {
            doubleDeducted.push(key);
        }
    });
    
    console.log("Double Deducted Delivered Orders:", doubleDeducted);
}

checkDouble();
