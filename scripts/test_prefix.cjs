const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function testPrefix() {
    const prefix = 'DO-Mahadi-260209';
    const { count, error } = await supabase
        .from('sales_orders')
        .select('*', { count: 'exact', head: true })
        .like('order_number', `${prefix}-%`);
        
    console.log("Count for", prefix, ":", count);
}

testPrefix();
