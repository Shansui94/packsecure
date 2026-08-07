import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function run() {
    const supabase = createClient(url, serviceKey);

    const todayStr = '2026-06-12';
    
    // Fetch all orders for today (order_date or created_at)
    const { data: orders, error: ordersErr } = await supabase
        .from('sales_orders')
        .select('*')
        .or(`order_date.eq.${todayStr},created_at.gte.2026-06-12T00:00:00+00:00`);

    if (ordersErr) {
        console.error("Failed to fetch orders:", ordersErr);
        return;
    }

    console.log(`Found ${orders.length} orders matching today's date (${todayStr}).`);

    // Fetch user details for mapping driver_id
    const { data: users, error: usersErr } = await supabase
        .from('users_public')
        .select('id, name, email');

    const userMap = {};
    if (users) {
        users.forEach(u => {
            userMap[u.id] = u;
        });
    }

    orders.forEach(o => {
        const driver = userMap[o.driver_id] || { name: 'Unknown/Unassigned', email: 'N/A' };
        const photos = o.pod_photo_url ? o.pod_photo_url.split(',') : [];
        const doPhoto = photos[0] || '';
        const prodPhoto = photos[1] || '';
        
        console.log(`- Order No: ${o.order_number}`);
        console.log(`  Driver: ${driver.name} (${driver.email}) | ID: ${o.driver_id}`);
        console.log(`  Status: ${o.status}`);
        console.log(`  Customer: ${o.customer}`);
        console.log(`  Trip Origin: ${o.trip_origin}`);
        console.log(`  Order Date: ${o.order_date}`);
        console.log(`  Created At: ${o.created_at}`);
        console.log(`  DO Photo: ${doPhoto ? 'UPLOADED (' + doPhoto.substring(0, 40) + '...)' : 'MISSING'}`);
        console.log(`  Product Photo: ${prodPhoto ? 'UPLOADED (' + prodPhoto.substring(0, 40) + '...)' : 'MISSING'}`);
        console.log(`  Full pod_photo_url: ${o.pod_photo_url || 'empty'}`);
        console.log(`-----------------------------------------------`);
    });
}

run();
