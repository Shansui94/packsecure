import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function run() {
    const supabase = createClient(url, serviceKey);

    // 1. Find Taufik's User ID
    const { data: user, error: userErr } = await supabase
        .from('users_public')
        .select('id, name, email')
        .eq('email', 'taufik.8646@packsecure.com')
        .single();

    if (userErr || !user) {
        console.error("Failed to find Taufik's user account:", userErr);
        return;
    }

    console.log(`Driver Found: ${user.name} (${user.email}) | ID: ${user.id}`);

    // Fetch orders assigned to Taufik that are created on or after 2026-06-11
    const { data: orders, error: ordersErr } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('driver_id', user.id)
        .gte('created_at', '2026-06-11T00:00:00+00:00')
        .order('created_at', { ascending: false });

    if (ordersErr) {
        console.error("Failed to fetch orders:", ordersErr);
        return;
    }

    console.log(`\nFound ${orders.length} orders assigned to Taufik since 2026-06-11.`);

    orders.forEach(o => {
        const photos = o.pod_photo_url ? o.pod_photo_url.split(',') : [];
        const doPhoto = photos[0] || '';
        const prodPhoto = photos[1] || '';
        
        console.log(`- Order No: ${o.order_number}`);
        console.log(`  Status: ${o.status}`);
        console.log(`  Customer: ${o.customer}`);
        console.log(`  Trip Origin: ${o.trip_origin}`);
        console.log(`  Order Date: ${o.order_date}`);
        console.log(`  Created At: ${o.created_at}`);
        console.log(`  DO Photo: ${doPhoto ? 'UPLOADED (' + doPhoto.substring(0, 50) + '...)' : 'MISSING'}`);
        console.log(`  Product Photo: ${prodPhoto ? 'UPLOADED (' + prodPhoto.substring(0, 50) + '...)' : 'MISSING'}`);
        console.log(`  Full pod_photo_url: ${o.pod_photo_url || 'empty'}`);
        console.log(`-----------------------------------------------`);
    });
}

run();
