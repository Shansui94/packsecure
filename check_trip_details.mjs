import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
    const orderNumber = 'DO-Ameer-260709-001';
    console.log(`=== Querying details for ${orderNumber} ===`);
    const { data: order, error } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('order_number', orderNumber)
        .maybeSingle();

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (!order) {
        console.log("Order not found");
        return;
    }

    console.log("Order details:", {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        trip_id: order.trip_id,
        driver_id: order.driver_id,
        delivery_address: order.delivery_address,
        created_at: order.created_at,
        updated_at: order.updated_at
    });

    if (order.trip_id) {
        console.log(`\n=== Querying all orders for trip_id = '${order.trip_id}' ===`);
        const { data: tripOrders, error: errTripOrders } = await supabase
            .from('sales_orders')
            .select('*')
            .eq('trip_id', order.trip_id);

        if (errTripOrders) {
            console.error("Error:", errTripOrders);
        } else {
            console.log(`Found ${tripOrders.length} orders on this trip:`);
            for (const to of tripOrders) {
                console.log(`- Order: ${to.order_number}, Status: ${to.status}, Driver: ${to.driver_id}, Address: ${to.delivery_address}`);
            }
        }

        console.log(`\n=== Querying trips_v2 for trip_id = '${order.trip_id}' ===`);
        const { data: tripV2, error: errTripV2 } = await supabase
            .from('trips_v2')
            .select('*')
            .eq('id', order.trip_id)
            .maybeSingle();

        if (errTripV2) {
            console.error("Error trips_v2:", errTripV2);
        } else {
            console.log("trips_v2 details:", tripV2);
        }

        console.log(`\n=== Querying trip_stops_v2 for trip_id = '${order.trip_id}' ===`);
        const { data: stops, error: errStops } = await supabase
            .from('trip_stops_v2')
            .select('*')
            .eq('trip_id', order.trip_id);

        if (errStops) {
            console.error("Error trip_stops_v2:", errStops);
        } else {
            console.log(`Found ${stops.length} stops in trip_stops_v2:`);
            for (const s of stops) {
                console.log(`- Stop ID: ${s.id}, Order ID: ${s.sales_order_id}, Status: ${s.status}, Sequence: ${s.sequence}`);
            }
        }
    }
}

run();
