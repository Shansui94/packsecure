import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const cutOffUtc = '2026-07-09T08:00:00.000Z'; // 4 PM Local Time (UTC+8)

    const { data: orders, error } = await supabase
        .from('sales_orders')
        .select('id, order_number, status, driver_id, created_at, deadline, order_date')
        .not('status', 'in', '("Delivered","Cancelled")')
        .not('driver_id', 'is', null)
        .lt('created_at', cutOffUtc)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${orders.length} uncompleted driver trips created before ${cutOffUtc}:`);
    orders.forEach(o => {
        console.log(`ID: ${o.id}, Order: ${o.order_number}, Status: ${o.status}, Driver: ${o.driver_id}, CreatedAt: ${o.created_at}, Deadline: ${o.deadline}`);
    });
}

check();
