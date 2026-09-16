import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Fetching orders with pod_photo_url...");
    const { data: orders, error } = await supabase
        .from('sales_orders')
        .select('id, order_number, customer, delivery_address, zone, driver_id, status, pod_photo_url, pod_timestamp, notes, created_at')
        .not('pod_photo_url', 'is', null)
        .order('pod_timestamp', { ascending: false, nullsFirst: false })
        .limit(10);

    if (error) {
        console.error("Error fetching orders:", error);
        return;
    }

    console.log(`Found ${orders?.length || 0} orders with pod_photo_url:`);
    for (const o of orders || []) {
        console.log(`\n--- Order: ${o.order_number} | Customer: ${o.customer} | Status: ${o.status} ---`);
        console.log(`Address: ${o.delivery_address} | Zone: ${o.zone}`);
        console.log(`POD Time: ${o.pod_timestamp} | Notes: ${o.notes}`);
        console.log(`POD Photo URL: ${o.pod_photo_url}`);
    }
}

main().catch(console.error);
