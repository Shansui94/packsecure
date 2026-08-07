import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
    console.log("=== Querying orders with pod_timestamp or pod_photo_url since 2026-07-09 ===");
    const { data, error } = await supabase
        .from('sales_orders')
        .select('*')
        .gte('updated_at', '2026-07-09T00:00:00Z');

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${data.length} orders updated since yesterday:`);
    for (const o of data) {
        if (o.pod_timestamp || o.pod_photo_url || o.proof_of_load_url) {
            console.log(`- Order: ${o.order_number}, Status: ${o.status}, Driver: ${o.driver_id}, Address: ${o.delivery_address}`);
            console.log(`  POD Time: ${o.pod_timestamp}`);
            console.log(`  POD Photo: ${o.pod_photo_url}`);
            console.log(`  POL Photo: ${o.proof_of_load_url}`);
            console.log(`  Notes: ${o.notes}`);
        }
    }
}

run();
