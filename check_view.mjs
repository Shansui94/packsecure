import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase
        .from('production_logs_v2')
        .select('sku, output_qty, created_at, machine_id')
        .eq('machine_id', 'T1.2-M01')
        .not('sku', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

    console.log("Error:", error);
    console.log("Last production:", data);
}

run();
