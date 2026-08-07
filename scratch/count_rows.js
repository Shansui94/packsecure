import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const tables = [
        'sys_users_v2', 
        'operator_attendance', 
        'work_photos', 
        'trips_v2', 
        'sales_orders', 
        'production_logs', 
        'production_metrics_calibration', 
        'production_material_inputs'
    ];

    for (const t of tables) {
        const { count, error } = await supabase
            .from(t)
            .select('*', { count: 'exact', head: true });
        
        if (error) {
            console.log(`Table ${t}: Error counting: ${error.message}`);
        } else {
            console.log(`Table ${t}: ${count} rows`);
        }
    }
}

check();
