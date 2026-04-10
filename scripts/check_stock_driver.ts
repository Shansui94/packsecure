import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env.production', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)![1].trim();
const supabaseKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)![1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking recent stock ledger v2 entries...");
    const { data, error } = await supabase.from('stock_ledger_v2').select('*')
        .order('created_at', { ascending: false }).limit(5);
    
    console.dir(data, { depth: null });
    
    // Let's also check recently updated sales_orders (status = Delivered)
    const { data: doData } = await supabase.from('sales_orders').select('id, order_number, status, items')
        .order('pod_timestamp', { ascending: false }).limit(3);
    
    console.log("\nRecent delivered DOs:");
    console.dir(doData, { depth: null });
}
check();
