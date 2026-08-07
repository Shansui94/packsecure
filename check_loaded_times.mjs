import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
    const deanId = 'c3eeab28-5960-4bef-b5d3-28d69dfa0b5d';
    console.log("=== Querying Loaded orders for Dean ===");
    
    const { data: orders, error } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('driver_id', deanId)
        .eq('status', 'Loaded');

    if (error) {
        console.error(error);
    } else {
        console.log(`Found ${orders.length} Loaded orders:`);
        for (const o of orders) {
            console.log(`- Order: ${o.order_number}, Address: ${o.delivery_address}, Created: ${o.created_at}, Updated: ${o.updated_at}`);
        }
    }
}

run();
