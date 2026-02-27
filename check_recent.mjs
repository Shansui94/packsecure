import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase
        .from('v2_inventory_view')
        .select('sku, loc_id, current_stock, last_updated')
        .order('last_updated', { ascending: false, nullsFirst: false })
        .limit(10);

    console.log("Error:", error);
    console.log("Recently Updated SKUs:", data);
}

run();
