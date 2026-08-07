import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log("=== Querying recent sales orders ===");
    const { data: orders, error } = await supabase
        .from('sales_orders')
        .select('id, order_number, status, driver_id, created_at, deadline, order_date')
        .gte('created_at', '2026-07-08T00:00:00.000Z')
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${orders.length} orders created since 2026-07-08`);
    if (orders.length > 0) {
        console.log("Samples (latest 10):");
        orders.slice(0, 10).forEach(o => {
            console.log(`Order: ${o.order_number}, Status: ${o.status}, Driver: ${o.driver_id}, CreatedAt: ${o.created_at}, Deadline: ${o.deadline}, OrderDate: ${o.order_date}`);
        });
    }
}

check();
