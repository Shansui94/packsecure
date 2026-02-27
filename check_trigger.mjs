import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase.rpc('query_pg_triggers', { table_name: 'stock_ledger_v2' });
    console.log("Error:", error);
    console.log("Triggers:", data);
}

run();
