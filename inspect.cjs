const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function run() {
    const { data, error } = await supabase
        .from('stock_ledger_v2')
        .update({ created_by_name: 'Max Tan (Admin)' })
        .eq('event_type', 'Audit Adjustment')
        .is('created_by_name', null);
    
    if (error) console.error(error);
    else console.log("Updated successfully!");
}

run();
