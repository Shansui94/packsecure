import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceKeyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const anonKeyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const key = serviceKeyMatch ? serviceKeyMatch[1].trim() : anonKeyMatch[1].trim();

const supabase = createClient(supabaseUrl, key);

async function check() {
    console.log("Checking recent stock ledger v2 entries...");
    const { data: stockData } = await supabase.from('stock_ledger_v2').select('*')
        .order('created_at', { ascending: false }).limit(5);
    
    console.dir(stockData, { depth: null });
    
    const { data: doData } = await supabase.from('sales_orders').select('id, order_number, status, items, pod_timestamp')
        .order('pod_timestamp', { ascending: false }).limit(5);
    
    console.log("\nRecent delivered DOs:");
    console.dir(doData, { depth: null });
}
check();
