import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
    let { data, error } = await supabase
        .from('machine_active_products')
        .select('*')
        .eq('machine_id', 'T1.3-M02');
        
    console.log("-------ACTIVE PRODUCTS-------");
    data?.forEach(d => console.log(d.machine_id, d.lane_id, d.product_sku));

    // Also get the last 5 logs for T1.3-M02
    let { data: logs } = await supabase
        .from('production_logs_v2')
        .select('created_at, sku, output_qty')
        .eq('machine_id', 'T1.3-M02')
        .order('created_at', { ascending: false })
        .limit(5);
        
    console.log("-------LAST 5 LOGS-------");
    logs?.forEach(l => console.log(l.created_at, l.sku, l.output_qty));
}

run();
