const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkOrder() {
    const { data: order, error } = await supabase.from('sales_orders').select('status, order_number').eq('order_number', 'DO-2026-4953').single();
    console.log("Order:", order || error);
}

checkOrder();
