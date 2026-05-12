const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkData() {
    const { data, error } = await supabase.from('sys_customers').select('*');
    console.log("Sys_customers items count:", data ? data.length : 0);
    if (error) console.error(error);
}

checkData();
