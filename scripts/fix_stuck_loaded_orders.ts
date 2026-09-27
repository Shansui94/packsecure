import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const vars: Record<string, string> = {};
envContent.split(/\r?\n/).forEach((l: string) => {
    const m = l.match(/^([A-Z_0-9]+)=(.+)$/);
    if (m) vars[m[1]] = m[2].trim();
});

const url = vars.VITE_SUPABASE_URL;
const key = vars.SUPABASE_SERVICE_ROLE_KEY || vars.VITE_SUPABASE_SERVICE_ROLE_KEY || vars.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error('Missing SUPABASE_URL or KEY');
    process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
    console.log('=== Checking Stuck Loaded Orders with Uploaded POD ===\n');

    // 1. Query candidate orders
    const { data: orders, error: fetchErr } = await supabase
        .from('sales_orders')
        .select('id, order_number, customer, status, trip_drop_count, pod_timestamp, pod_photo_url, trip_id, driver_id')
        .eq('status', 'Loaded')
        .not('pod_timestamp', 'is', null)
        .gte('pod_timestamp', '2026-09-25T00:00:00.000Z')
        .order('pod_timestamp', { ascending: true });

    if (fetchErr) {
        console.error('Fetch error:', fetchErr);
        return;
    }

    if (!orders || orders.length === 0) {
        console.log('No stuck orders found!');
        return;
    }

    console.log(`Found ${orders.length} stuck orders in 'Loaded' state with uploaded POD:`);
    orders.forEach((o, idx) => {
        console.log(`[${idx + 1}/${orders.length}] DO: ${o.order_number || 'N/A'} | Customer: ${o.customer} | POD Time: ${o.pod_timestamp} | Drops: ${o.trip_drop_count} | TripID: ${o.trip_id || 'none'}`);
    });

    console.log('\n--- Updating Orders to Delivered ---');
    const orderIds = orders.map(o => o.id);
    const { data: updatedOrders, error: updateErr } = await supabase
        .from('sales_orders')
        .update({ status: 'Delivered' })
        .in('id', orderIds)
        .select('id, order_number, status');

    if (updateErr) {
        console.error('Error updating orders:', updateErr);
        return;
    }
    console.log(`✅ Successfully promoted ${updatedOrders?.length || 0} orders to 'Delivered'.\n`);

    // 2. Also check and complete trips_v2
    const tripIds = Array.from(new Set(orders.map(o => o.trip_id).filter(Boolean)));
    console.log(`Checking ${tripIds.length} associated trips in trips_v2...`);

    let completedTripsCount = 0;
    for (const tripId of tripIds) {
        const { data: siblings } = await supabase
            .from('sales_orders')
            .select('id, order_number, status')
            .eq('trip_id', tripId)
            .neq('status', 'Cancelled');

        const allDone = siblings && siblings.length > 0 && siblings.every(s => s.status === 'Delivered');
        if (allDone) {
            const { error: tripErr } = await supabase
                .from('trips_v2')
                .update({ 
                    status: 'Completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', tripId);

            if (!tripErr) {
                completedTripsCount++;
                console.log(`  - Trip ${tripId}: All ${siblings.length} orders delivered. Marked trips_v2 as 'Completed'.`);
            } else {
                console.warn(`  - Trip ${tripId} update warning:`, tripErr.message);
            }
        } else {
            const pendingList = siblings?.filter(s => s.status !== 'Delivered').map(s => s.order_number).join(', ');
            console.log(`  - Trip ${tripId}: Still has pending orders (${pendingList}). Left in progress.`);
        }
    }

    console.log(`\n🎉 Done! ${updatedOrders?.length || 0} orders updated to Delivered, ${completedTripsCount} trips completed.`);
}

main().catch(console.error);
