import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const DRIVER_0514_ID = '296c7093-9633-4aca-8ba0-0847464df195';
const TRIP_ID = '85b7c6fc-4a9f-4d37-8905-ecf4b973ed47';
const LORRY_ID = '23572333-dba1-421a-b6fd-83d937cfe954'; // APD 9821

async function resetAll() {
    console.log('--- Resetting Trip, Orders, and Lorry for User Manual Recording (Driver 0514) ---');

    // 1. Reset all 10 sales_orders to Planned
    const { data: updatedOrders, error: orderErr } = await supabase
        .from('sales_orders')
        .update({
            driver_id: DRIVER_0514_ID,
            status: 'Planned',
            pod_signature_url: null,
            pod_photo_url: null,
            pod_signed_by: null,
            pod_timestamp: null
        })
        .eq('trip_id', TRIP_ID)
        .select('id, order_number, status');

    if (orderErr) console.error('Order reset error:', orderErr);
    else console.log(`✅ Reset ${updatedOrders?.length} sales_orders in trip to 'Planned' for 0514:`, updatedOrders?.map(o => o.order_number));

    // 2. Reset trip in trips_v2
    const { error: tripErr } = await supabase
        .from('trips_v2')
        .update({
            driver_id: DRIVER_0514_ID,
            trip_number: 'TRIP-260919-0514',
            status: 'Planned',
            start_odometer: null,
            end_odometer: null,
            start_odometer_photo_url: null,
            end_odometer_photo_url: null,
            started_at: null,
            completed_at: null
        })
        .eq('id', TRIP_ID);

    if (tripErr) console.error('Trip reset error:', tripErr);
    else console.log(`✅ Reset trip ${TRIP_ID} to status='Planned' for 0514`);

    // 3. Reset lorry APD 9821
    const { error: lorryErr } = await supabase
        .from('lorries')
        .update({
            status: 'Active',
            driver_id: null,
            driver_name: null
        })
        .eq('id', LORRY_ID);

    if (lorryErr) console.error('Lorry reset error:', lorryErr);
    else console.log(`✅ Lorry APD 9821 reset to 'Active' with no driver bound.`);

    console.log('\n>>> All test data successfully reset! Max Tan can start fresh from Lorry Binding! <<<');
}

resetAll().catch(console.error);
