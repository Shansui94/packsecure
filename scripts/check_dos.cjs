const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkDOs() {
    const { data } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .in('ref_doc', ['DO-2026-3960', 'DO-2026-4425']);
        
    console.log(data);
}

checkDOs();
