const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkItemLoc() {
    const { data: order } = await supabase
        .from('sales_orders')
        .select('order_number, items')
        .eq('order_number', 'DO-2026-3871')
        .single();
        
    const merahItem = order.items.find(i => i.sku === 'BW-SL-CLR-100Mx100CMx1ROLL-RED' || i.sku === 'BW-SL-CLR-100Mx100CMx1ROLL RED');
    console.log(order.order_number, "MERAH item sourceLocation:", merahItem?.sourceLocation);
}

checkItemLoc();
