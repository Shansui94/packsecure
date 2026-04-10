import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceKeyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const key = serviceKeyMatch[1].trim();
const supabase = createClient(supabaseUrl, key);

async function check() {
    // 1. Check last 3 delivered DOs
    const { data: dos } = await supabase.from('sales_orders')
        .select('id, order_number, pod_timestamp, deadline')
        .order('pod_timestamp', { ascending: false })
        .limit(3);
    
    console.log("RECENT DELIVERED DOs:");
    console.log(dos);
    
    // 2. Fetch the stock ledger corresponding to those DOs
    if (dos && dos.length > 0) {
        const orderNumbers = dos.map(d => d.order_number);
        const { data: stocks } = await supabase.from('stock_ledger_v2')
            .select('timestamp, sku, loc_id, change_qty, ref_doc')
            .in('ref_doc', orderNumbers)
            .order('timestamp', { ascending: false });
        
        console.log("\nSTOCK OUT RECORDS FOR THOSE DOs:");
        console.log(stocks);
    }
}
check();
