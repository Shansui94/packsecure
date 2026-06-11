import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const { data, error } = await s
        .from('sales_orders')
        .select('status');
        
    if (error) {
        console.error(error.message);
        return;
    }
    
    const statuses = [...new Set(data.map(o => o.status))];
    console.log("Unique sales_orders statuses in database:", statuses);
}

run();
