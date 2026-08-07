import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log("=== Checking orders manually completed by System ===");
    
    const { data: orders, error } = await supabase
        .from('sales_orders')
        .select('id, order_number, status, driver_id, created_at, deadline, notes')
        .like('notes', '%[System Manual Complete]%');

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${orders.length} orders updated by the script.`);
    
    const todayOrLater = orders.filter(o => o.deadline >= '2026-07-10');
    console.log(`Of these, ${todayOrLater.length} have deadline >= 2026-07-10:`);
    todayOrLater.forEach(o => {
        console.log(`Order: ${o.order_number}, Status: ${o.status}, CreatedAt: ${o.created_at}, Deadline: ${o.deadline}, Notes: ${o.notes}`);
    });
}

check();
