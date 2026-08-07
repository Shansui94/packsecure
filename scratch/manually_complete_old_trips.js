import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const cutOffUtc = '2026-07-09T08:00:00.000Z'; // 4 PM Local Time (UTC+8) yesterday

    console.log(`=== Finding uncompleted driver orders created before ${cutOffUtc} ===`);

    const { data: orders, error: fetchErr } = await supabase
        .from('sales_orders')
        .select('id, order_number, status, driver_id, created_at, deadline')
        .not('status', 'in', '("Delivered","Cancelled")')
        .not('driver_id', 'is', null)
        .lt('created_at', cutOffUtc);

    if (fetchErr) {
        console.error("Error fetching orders:", fetchErr);
        return;
    }

    console.log(`Found ${orders.length} orders to update.`);

    if (orders.length === 0) {
        console.log("No orders need to be completed.");
        return;
    }

    // Get user names for printing
    const { data: users } = await supabase.from('sys_users_v2').select('auth_user_id, name, employee_id');
    const { data: pubUsers } = await supabase.from('users_public').select('id, name, employee_id');

    const userMap = {};
    users?.forEach(u => { userMap[u.auth_user_id] = `${u.name} (${u.employee_id})`; });
    pubUsers?.forEach(u => { userMap[u.id] = `${u.name} (${u.employee_id})`; });

    let updatedCount = 0;

    for (const order of orders) {
        const driverName = userMap[order.driver_id] || order.driver_id;
        const timestamp = order.deadline ? `${order.deadline}T12:00:00.000Z` : order.created_at;

        console.log(`Updating ${order.order_number} for driver ${driverName} (Created: ${order.created_at}, Deadline: ${order.deadline})`);

        // 1. Update sales_orders
        const { error: err1 } = await supabase
            .from('sales_orders')
            .update({
                status: 'Delivered',
                pod_timestamp: timestamp,
                notes: `[System Manual Complete] Completed on ${new Date().toISOString()}`
            })
            .eq('id', order.id);

        if (err1) {
            console.error(`Error updating sales_order ${order.order_number}:`, err1.message);
            continue;
        }

        // 2. Update trip_stops_v2 if it exists
        try {
            const { error: err2 } = await supabase
                .from('trip_stops_v2')
                .update({
                    status: 'Delivered',
                    pod_timestamp: timestamp
                })
                .eq('sales_order_id', order.id);
            
            if (err2 && err2.message.includes('Could not find the table')) {
                // Ignore if table doesn't exist
            } else if (err2) {
                console.error(`Error updating trip_stops_v2 for ${order.order_number}:`, err2.message);
            }
        } catch (e) {
            // Ignore
        }

        updatedCount++;
    }

    console.log(`=== Done! Successfully completed ${updatedCount} / ${orders.length} orders ===`);
}

run();
