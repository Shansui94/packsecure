import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("=== Reverting today's active trips to 'Loaded' ===");
    
    // 1. Fetch sales_orders for June 11 that were marked Delivered but have pod_timestamp on June 12 MYT
    const { data: orders, error: fetchError } = await s
        .from('sales_orders')
        .select('id, order_number, customer, status, pod_timestamp')
        .or('deadline.eq.2026-06-11,order_date.eq.2026-06-11')
        .eq('status', 'Delivered');

    if (fetchError) {
        console.error("Error fetching orders:", fetchError.message);
        return;
    }

    // June 12, 2026 00:00:00 MYT is June 11, 2026 16:00:00 UTC
    const cutOff = new Date('2026-06-11T16:00:00.000Z');
    
    const toRevert = orders.filter(o => o.pod_timestamp && new Date(o.pod_timestamp) >= cutOff);
    console.log(`Found ${toRevert.length} orders with photos taken today to revert to 'Loaded'.`);

    if (toRevert.length === 0) {
        console.log("No orders need reverting.");
        return;
    }

    const idsToRevert = toRevert.map(o => o.id);
    
    // 2. Update status back to 'Loaded'
    const { data: updated, error: updateError } = await s
        .from('sales_orders')
        .update({ status: 'Loaded' })
        .in('id', idsToRevert)
        .select('id, order_number, status');

    if (updateError) {
        console.error("Error updating orders:", updateError.message);
        return;
    }

    console.log(`Successfully reverted ${updated.length} orders to 'Loaded':`);
    updated.forEach(o => {
        console.log(`- Order: ${o.order_number || o.id} -> Status: ${o.status}`);
    });
}

run();
