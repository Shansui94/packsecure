import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
    console.log("=== Querying stock_ledger_v2 for 2026-06-15 ===");
    const { data, error } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .gte('timestamp', '2026-06-15T00:00:00.000Z')
        .lte('timestamp', '2026-06-15T23:59:59.999Z')
        .order('timestamp', { ascending: false });
    
    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`Found ${data?.length || 0} records.`);
        console.log(JSON.stringify(data, null, 2));
    }
}

run();
