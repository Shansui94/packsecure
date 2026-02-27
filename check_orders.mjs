import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkOrders() {
    const { data: o, error } = await supabaseAdmin.from('sales_orders').select('id, items, delivery_address, zone, order_date, deadline').neq('status', 'Delivered').neq('status', 'Cancelled').limit(5);
    console.log("Found orders:", o?.length, error);
    if (o) {
        o.forEach(ord => {
            console.log("\nOrder:", ord.id, "Date:", ord.order_date, "Deadline:", ord.deadline);
            console.log("Address:", ord.delivery_address);
            console.log("Zone:", ord.zone);
            console.log("Items:", JSON.stringify(ord.items));
        })
    }
}
checkOrders();
