const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkData() {
    const { data, error } = await supabase.from('sales_orders').select('count', { count: 'exact', head: true });
    console.log("Sales Orders count:", data, error);
}

checkData();
