import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase
        .from('stock_ledger_v2')
        .select('sku, change_qty, event_type, loc_id, notes, timestamp')
        .order('timestamp', { ascending: false, nullsFirst: false })
        .limit(15);

    console.log("Error:", error);
    console.log("Latest Ledger Logs:");
    if (data) {
        data.forEach(row => {
            console.log(`- ${row.timestamp}: [${row.loc_id}] [${row.event_type}] ${row.sku} (Change: ${row.change_qty}) - ${row.notes}`);
        });
    }
}

run();
