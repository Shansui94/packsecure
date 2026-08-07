import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("=== Completing yesterday's loaded trips with photos ===");
    
    // 1. Fetch yesterday's sales orders that are Loaded
    const { data: orders, error: fetchError } = await s
        .from('sales_orders')
        .select('id, order_number, customer, status, pod_photo_url')
        .or('deadline.eq.2026-06-11,order_date.eq.2026-06-11')
        .eq('status', 'Loaded');

    if (fetchError) {
        console.error("Error fetching orders:", fetchError.message);
        return;
    }

    const toUpdate = orders.filter(o => o.pod_photo_url && o.pod_photo_url.trim() !== '');
    console.log(`Found ${toUpdate.length} loaded orders with photos to mark as Delivered.`);

    if (toUpdate.length === 0) {
        console.log("No orders need updating.");
        return;
    }

    const idsToUpdate = toUpdate.map(o => o.id);
    
    // 2. Perform batch update to 'Delivered'
    const { data: updated, error: updateError } = await s
        .from('sales_orders')
        .update({ status: 'Delivered' })
        .in('id', idsToUpdate)
        .select('id, order_number, status');

    if (updateError) {
        console.error("Error updating orders:", updateError.message);
        return;
    }

    console.log(`Successfully updated ${updated.length} orders to 'Delivered':`);
    updated.forEach(o => {
        console.log(`- Order: ${o.order_number || o.id} -> Status: ${o.status}`);
    });
}

run();
