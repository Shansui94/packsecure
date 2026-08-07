import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    const { data, error } = await supabase.from('sales_orders').select('*').limit(1);
    if (error) {
        console.error("Error fetching sales_orders:", error);
    } else if (data && data.length > 0) {
        console.log("sales_orders columns:", Object.keys(data[0]));
    } else {
        console.log("No orders found to inspect columns, trying to fetch schema info...");
    }
}
run();
