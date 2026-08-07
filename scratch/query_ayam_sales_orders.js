import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const userUid = 'ffeb9b0a-0d32-41f2-ba81-f2257ba45c17'; // Ayam's auth_user_id

    const { data: orders, error } = await supabase
        .from('sales_orders')
        .select('order_number, status, deadline, created_at')
        .eq('driver_id', userUid)
        .in('status', ['Loaded', 'New']);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`=== Loaded / New orders for Ayam count: ${orders.length} ===`);
    orders.forEach(o => {
        console.log(`Order: ${o.order_number}, Status: ${o.status}, Deadline: ${o.deadline}, CreatedAt: ${o.created_at}`);
    });
}

check();
