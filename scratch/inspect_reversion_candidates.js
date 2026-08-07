import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data: orders, error } = await supabase
        .from('sales_orders')
        .select('id, order_number, status, driver_id, created_at, deadline, proof_of_load_url, notes')
        .like('notes', '%[System Manual Complete]%')
        .is('proof_of_load_url', null);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`=== 11 orders with no proof of load ===`);
    orders.forEach(o => {
        // We can inspect if the order_number contains a driver name like DO-Tahir-xxx or DO-HQ-xxx
        // Let's guess original status based on order_number and other fields
        console.log(`Order: ${o.order_number}, CreatedAt: ${o.created_at}, Deadline: ${o.deadline}, Notes: ${o.notes}`);
    });
}

check();
