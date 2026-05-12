const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check9927() {
    const { data: order } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('order_number', 'DO-2026-9927')
        .single();
        
    console.log("Order Data:", order);
}

check9927();
