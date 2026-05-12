const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check1143() {
    const { data: order } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('order_number', 'DO-2026-1143')
        .single();
        
    console.log("Order Data:", order);
    if (order) {
        console.log("Status:", order.status);
        console.log("Items:");
        order.items.forEach(i => console.log(`- ${i.sku} | Qty: ${i.quantity} | Loc: ${i.sourceLocation}`));
    }
    
    const { data: logs } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('ref_doc', 'DO-2026-1143');
        
    console.log("\nLedger Logs:", logs.length);
    logs.forEach(l => console.log(`${l.event_type} | ${l.sku} | ${l.change_qty} | ${l.loc_id} | ${l.notes} | ${l.timestamp}`));
}

check1143();
