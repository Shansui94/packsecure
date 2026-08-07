import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0 && !line.startsWith('#')) {
        env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
}
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
    console.log("Deleting test orders starting with TEST-SO-...");
    const { data, error } = await supabase
        .from('sales_orders')
        .delete()
        .like('order_number', 'TEST-SO-%')
        .select();

    if (error) {
        console.error("Error deleting test orders:", error);
    } else {
        console.log(`Successfully deleted ${data ? data.length : 0} test orders!`);
    }
}
run();
