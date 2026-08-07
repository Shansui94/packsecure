import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function run() {
    const supabase = createClient(url, serviceKey);

    // Get Taufik's driver ID
    const { data: user, error: userErr } = await supabase
        .from('users_public')
        .select('id, name, email')
        .eq('email', 'taufik.8646@packsecure.com')
        .single();

    if (userErr || !user) {
        console.error("Failed to find Taufik's user account:", userErr);
        return;
    }
    console.log(`Driver ID: ${user.id}`);

    // Query 1: by driver_id
    const { data: ordersById, error: err1 } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false });

    // Query 2: by order_number containing Taufik (in case of wrong driver_id mapping)
    const { data: ordersByName, error: err2 } = await supabase
        .from('sales_orders')
        .select('*')
        .ilike('order_number', '%Taufik%')
        .order('created_at', { ascending: false });

    if (err1 || err2) {
        console.error("Errors:", err1, err2);
        return;
    }

    // Combine and deduplicate
    const allOrdersMap = new Map();
    if (ordersById) ordersById.forEach(o => allOrdersMap.set(o.id, o));
    if (ordersByName) ordersByName.forEach(o => allOrdersMap.set(o.id, o));
    const allOrders = Array.from(allOrdersMap.values());

    // Sort by created_at desc
    allOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    console.log(`Found ${allOrders.length} total unique orders for Taufik in history.`);

    // Filter to last 5 days
    const recentOrders = allOrders.filter(o => {
        const date = new Date(o.created_at);
        const cutoff = new Date('2026-06-08T00:00:00Z');
        return date >= cutoff;
    });

    console.log(`\n--- Recent Orders (Since 2026-06-08) ---`);
    recentOrders.forEach(o => {
        const photos = o.pod_photo_url ? o.pod_photo_url.split(',') : [];
        const doPhoto = photos[0] || '';
        const prodPhoto = photos[1] || '';
        console.log(`- Order No: ${o.order_number}`);
        console.log(`  Driver ID: ${o.driver_id}`);
        console.log(`  Status: ${o.status}`);
        console.log(`  Customer: ${o.customer}`);
        console.log(`  Trip Origin: ${o.trip_origin}`);
        console.log(`  Order Date: ${o.order_date}`);
        console.log(`  Created At: ${o.created_at}`);
        console.log(`  Updated At: ${o.updated_at}`);
        console.log(`  Notes: ${o.notes || 'none'}`);
        console.log(`  DO Photo: ${doPhoto ? 'UPLOADED (' + doPhoto.substring(0, 55) + ')' : 'MISSING'}`);
        console.log(`  Product Photo: ${prodPhoto ? 'UPLOADED (' + prodPhoto.substring(0, 55) + ')' : 'MISSING'}`);
        console.log(`  Full pod_photo_url: ${o.pod_photo_url || 'empty'}`);
        console.log(`-----------------------------------------------`);
    });
}

run();
