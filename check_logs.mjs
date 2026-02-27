import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    const { data, error } = await supabaseAdmin.from('production_logs').select('id, product_sku, lane_id, alarm_count').eq('machine_id', 'T1.2-M01').order('created_at', { ascending: false }).limit(5);
    console.log(data, error);
}
check();
