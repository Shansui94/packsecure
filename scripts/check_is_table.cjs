const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkIsTable() {
    // Try to insert a dummy record (it will fail with 'cannot insert into view' if it's a view)
    const { data, error } = await supabase.from('v2_inventory_view').insert([{ sku: 'DUMMY' }]);
    console.log(error?.message || "Inserted (It's a table!)");
}

checkIsTable();
