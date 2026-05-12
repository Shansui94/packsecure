const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkAgain() {
    const { data: logs } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('ref_doc', 'DO-2026-3929');
        
    console.log("Ledger Logs Now:", logs);
}

checkAgain();
