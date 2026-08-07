import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkAmeerRealtime() {
    const { data: order, error } = await supabase
        .from('sales_orders')
        .select('id, order_number, status, driver_id, notes, pod_timestamp')
        .eq('order_number', 'DO-Ameer-260619-001')
        .maybeSingle();

    if (error) {
        console.error(error);
        return;
    }

    console.log("=== Real-time Database Status for DO-Ameer-260619-001 ===");
    if (order) {
        console.log(`Status: ${order.status}`);
        console.log(`Notes: ${order.notes}`);
        console.log(`POD Timestamp: ${order.pod_timestamp}`);
    } else {
        console.log("Order not found!");
    }
}

checkAmeerRealtime();
