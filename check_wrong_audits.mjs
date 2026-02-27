import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase
        .from('stock_ledger_v2')
        .select('txn_id, sku, change_qty, loc_id, timestamp')
        .eq('event_type', 'Audit Adjustment')
        .eq('loc_id', 'SPD')
        .order('timestamp', { ascending: false })
        .limit(20);

    console.log("Error:", error);
    console.log("Recent SPD Audits:", data);
}

run();
