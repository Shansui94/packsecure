import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const { data, error } = await s.from('sales_orders').select('*').limit(1);
    if (error) {
        console.error("Error fetching sales_orders:", error);
    } else {
        console.log("Sales order record keys:", Object.keys(data[0] || {}));
        console.log("Sample Sales order record:", data[0]);
    }
}

run();
