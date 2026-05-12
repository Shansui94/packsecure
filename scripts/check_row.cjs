const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkRow() {
    const { data: logs } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('ref_doc', 'DO-2026-3597');
        
    console.log(logs);
}

checkRow();
