const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function dumpFirstRow() {
    const { data } = await supabase.from('stock_ledger_v2').select('*').limit(1);
    console.log("First row:", data);
}

dumpFirstRow();
