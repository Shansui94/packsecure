import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase
        .from('v2_inventory_view')
        .select('*')
        .limit(1);

    if (error) {
        console.log("Error querying view:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log("Columns:", Object.keys(data[0]));
    } else {
        console.log("No data returned, cannot infer columns.");
    }
}

run();
