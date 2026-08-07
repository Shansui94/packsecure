import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("=== Checking yesterday's orders (2026-06-11) ===");
    
    // Query sales_orders for June 11, 2026
    const { data, error } = await s
        .from('sales_orders')
        .select('id, order_number, customer, status, driver_id, deadline, order_date, pod_photo_url, pod_timestamp')
        .or('deadline.eq.2026-06-11,order_date.eq.2026-06-11');

    if (error) {
        console.error("Error fetching orders:", error.message);
        return;
    }

    console.log(`Found ${data.length} orders total for June 11.`);
    
    const loadedWithPhotos = data.filter(o => o.status === 'Loaded' && o.pod_photo_url && o.pod_photo_url.trim() !== '');
    console.log(`\n=== Loaded orders with photos: ${loadedWithPhotos.length} ===`);
    loadedWithPhotos.forEach(o => {
        console.log(`Order: ${o.order_number || o.id}, Customer: ${o.customer}, Driver: ${o.driver_id}, Photos: ${o.pod_photo_url?.slice(0, 50)}...`);
    });

    const otherLoaded = data.filter(o => o.status === 'Loaded' && (!o.pod_photo_url || o.pod_photo_url.trim() === ''));
    console.log(`\n=== Loaded orders WITHOUT photos: ${otherLoaded.length} ===`);
    otherLoaded.forEach(o => {
        console.log(`Order: ${o.order_number || o.id}, Customer: ${o.customer}, Driver: ${o.driver_id}`);
    });

    const delivered = data.filter(o => o.status === 'Delivered');
    console.log(`\n=== Already Delivered orders: ${delivered.length} ===`);
}

run();
