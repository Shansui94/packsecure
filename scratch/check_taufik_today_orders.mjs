import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function run() {
    const supabase = createClient(url, serviceKey);

    // 1. Find Taufik's User ID
    const { data: users, error: userErr } = await supabase
        .from('users_public')
        .select('id, name, email')
        .eq('email', 'taufik.8646@packsecure.com')
        .single();

    if (userErr || !users) {
        console.error("Failed to find Taufik's user account:", userErr);
        return;
    }

    console.log(`Driver Found: ${users.name} (${users.email}) | ID: ${users.id}`);

    // Get today's date in local time range (or standard UTC range for June 12, 2026)
    // The user's timezone date is 2026-06-12
    const startOfToday = '2026-06-12T00:00:00+08:00';
    const endOfToday = '2026-06-12T23:59:59+08:00';

    // 2. Fetch Taufik's orders for today
    const { data: orders, error: ordersErr } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('driver_id', users.id)
        .order('created_at', { ascending: false });

    if (ordersErr) {
        console.error("Failed to fetch orders:", ordersErr);
        return;
    }

    console.log(`\nFound ${orders.length} total orders assigned to Taufik.`);

    // Filter to today's orders (e.g. created_at or delivery_date/order_date)
    // Let's print all of them to inspect their dates
    console.log("\nDetails of Taufik's orders:");
    orders.forEach(o => {
        const photos = o.pod_photo_url ? o.pod_photo_url.split(',') : [];
        const doPhoto = photos[0] || 'MISSING';
        const prodPhoto = photos[1] || 'MISSING';
        
        console.log(`- Order No: ${o.order_number}`);
        console.log(`  Status: ${o.status}`);
        console.log(`  Customer: ${o.customer}`);
        console.log(`  Trip Origin: ${o.trip_origin}`);
        console.log(`  Order Date: ${o.order_date}`);
        console.log(`  Deadline: ${o.deadline}`);
        console.log(`  Created At: ${o.created_at}`);
        console.log(`  DO Photo: ${doPhoto}`);
        console.log(`  Product Photo: ${prodPhoto}`);
        console.log(`  Total Photos Count: ${photos.length}`);
        console.log(`  Full pod_photo_url: ${o.pod_photo_url || 'empty'}`);
        console.log(`-----------------------------------------------`);
    });
}

run();
