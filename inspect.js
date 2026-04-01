const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function run() {
    const { data, error } = await supabase
        .from('stock_ledger_v2')
        .select('txn_id, created_by, created_by_name, timestamp, ref_doc, sku')
        .eq('event_type', 'Audit Adjustment')
        .order('timestamp', { ascending: false })
        .limit(3);
    
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

run();
