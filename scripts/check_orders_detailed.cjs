const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkOrdersDetailed() {
    const { data: logs } = await supabase
        .from('stock_ledger_v2')
        .select('ref_doc')
        .eq('timestamp', '2026-04-28T08:00:00+00:00')
        .limit(5);
        
    const orderNumbers = logs.map(l => l.ref_doc);
    
    const { data: orders } = await supabase
        .from('sales_orders')
        .select('order_number, created_at, status, pod_timestamp')
        .in('order_number', orderNumbers);
        
    console.log("Orders corresponding to 08:00:00Z logs:");
    console.log(orders);
}

checkOrdersDetailed();
