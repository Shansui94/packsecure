import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const userUid = 'ffeb9b0a-0d32-41f2-ba81-f2257ba45c17'; // Ayam's auth_user_id

    const { data: JulyOrders } = await supabase
        .from('sales_orders')
        .select('order_number, status, deadline')
        .eq('driver_id', userUid)
        .eq('status', 'Delivered')
        .gte('deadline', '2026-07-01')
        .lte('deadline', '2026-07-31');

    console.log(`=== Ayam's Delivered July 2026 Orders count: ${JulyOrders?.length || 0} ===`);
    JulyOrders?.forEach(o => {
        console.log(`Order: ${o.order_number}, Status: ${o.status}, Deadline: ${o.deadline}`);
    });
}

check();
