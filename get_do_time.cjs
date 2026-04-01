const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function run() {
    const { data, error } = await supabase
        .from('sales_orders')
        .select('order_number, pod_timestamp, driver_id, status')
        .eq('order_number', 'DO-2026-0445');
    
    if (error) console.error(error);
    else fs.writeFileSync('get_do_time.json', JSON.stringify(data, null, 2));
}

run();
