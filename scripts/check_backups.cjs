const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkBackups() {
    // Check if there are any tables like 'stock_ledger_v2_backup'
    const { data: tables, error } = await supabase.rpc('get_tables'); // Or just query information_schema
    
    const { data, error: err2 } = await supabase
        .from('stock_ledger_v2_audit')
        .select('*')
        .limit(1);
        
    if (!err2) {
        console.log("Found an audit table!");
    } else {
        console.log("No audit table found.");
    }
}

checkBackups();
