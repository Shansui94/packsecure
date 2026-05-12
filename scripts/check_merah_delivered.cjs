const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkMerahToday() {
    const { data: logs } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED')
        .gte('timestamp', '2026-04-27T16:00:00+00:00') // MYT 28th 00:00
        .eq('event_type', 'Transfer Out')
        .like('notes', '%Delivered%');
        
    console.log(`Found ${logs.length} delivered logs for MERAH today.`);
    console.log(logs.map(l => `${l.ref_doc} | ${l.change_qty} | ${l.timestamp}`));
    
    // Also check if any orders with MERAH were delivered today
    // We have to query sales_orders where status is Delivered and items contain MERAH
    const { data: orders } = await supabase
        .from('sales_orders')
        .select('order_number, items, updated_at, pod_timestamp')
        .eq('status', 'Delivered')
        .gte('updated_at', '2026-04-27T16:00:00+00:00');
        
    const merahOrders = orders.filter(o => o.items && o.items.some(i => i.sku === 'BW-SL-CLR-100Mx100CMx1ROLL-RED' || i.sku === 'BW-SL-CLR-100Mx100CMx1ROLL RED'));
    console.log(`Found ${merahOrders.length} Delivered orders containing MERAH updated today.`);
    console.log(merahOrders.map(o => `${o.order_number} | updated: ${o.updated_at}`));
}

checkMerahToday();
