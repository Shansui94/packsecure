import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    const { data: orders, error } = await supabase.from('sales_orders')
        .select('order_number, factory_id, items, created_at')
        .gte('created_at', '2026-04-19T00:00:00Z')
        .lte('created_at', '2026-04-21T23:59:59Z');
        
    let foundIssues = 0;
    
    orders?.forEach(o => {
        if (!o.items) return;
        o.items.forEach(item => {
            if (item.sourceLocation && item.sourceLocation !== o.factory_id) {
                console.log(`\nOrder: ${o.order_number} (${o.created_at})`);
                console.log(`  Order Level Factory: ${o.factory_id}`);
                console.log(`  Item [${item.sku}] Source Location: ${item.sourceLocation}`);
                foundIssues++;
            }
        });
    });
    
    console.log(`\nTotal items where sourceLocation differs from order factory_id: ${foundIssues}`);
}
main();
