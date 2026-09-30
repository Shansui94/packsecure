import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TAHIR_ID = '1fcff5ee-f671-4b9a-9749-4745921093e8';
const MAHADI_ID = 'cc2dc059-b4ea-4457-bd40-bca51eb25ec6';
const TRIP_ID = 'abc531fd-d2a7-4199-ab70-56d7bcee87d7'; // TRIP-260929-120
const APH_LORRY_ID = 'deb94a13-57aa-4c23-b7b2-0a0e3f659383'; // APH 9821

const TARGET_ORDER_IDS = [
  'ce86a644-3de2-47a8-8234-2474fe242087', // OPM2609-1166
  '12727e46-585b-4021-965f-45388b594ca6', // OPM2609-1167
  '2b45c0a2-ac70-42ef-858e-42feb5b18b0c', // OPM2609-1168
  '09cf609f-ee90-473c-9e8b-499888bfea6a', // OPM2609-1170
  'c576b278-809e-4a9f-9960-c2a24fe7d6b1', // OPM2609-1179
  '3cfee177-d17a-49af-83f8-99269b63d346', // OPM2609-1180
  '93b1ee94-7e0b-40fc-ad39-ca25c1bef0c5', // WEHENG-DO-016995
];

async function main() {
  console.log('=== Step 1: Pre-Execution Verification ===');
  const { data: tripBefore, error: tripErr } = await supabase
    .from('trips_v2')
    .select('id, trip_number, driver_id, lorry_id, status')
    .eq('id', TRIP_ID)
    .single();

  if (tripErr || !tripBefore) {
    console.error('Trip not found:', tripErr);
    process.exit(1);
  }
  console.log('Current Trip State:', tripBefore);

  const { data: ordersBefore, error: ordersErr } = await supabase
    .from('sales_orders')
    .select('id, order_number, customer, driver_id, trip_id, trip_sequence, status')
    .in('id', TARGET_ORDER_IDS);

  if (ordersErr || !ordersBefore) {
    console.error('Orders query failed:', ordersErr);
    process.exit(1);
  }
  console.log(`Found ${ordersBefore.length} orders currently assigned to driver_id:`, ordersBefore[0]?.driver_id);

  console.log('\n=== Step 2: Executing Trip Reassignment to Tahir ===');
  // 1. Update trip in trips_v2
  const { data: tripUpdated, error: tripUpErr } = await supabase
    .from('trips_v2')
    .update({
      driver_id: TAHIR_ID,
      lorry_id: APH_LORRY_ID
    })
    .eq('id', TRIP_ID)
    .select();

  if (tripUpErr) {
    console.error('Failed to update trip:', tripUpErr);
    process.exit(1);
  }
  console.log('Trip successfully updated to Tahir (1fcff5ee...):', tripUpdated);

  // 2. Update all 7 sales orders
  const { data: ordersUpdated, error: ordersUpErr } = await supabase
    .from('sales_orders')
    .update({
      driver_id: TAHIR_ID,
      trip_sequence: 1,
      updated_at: new Date().toISOString()
    })
    .in('id', TARGET_ORDER_IDS)
    .select('id, order_number, customer, driver_id, trip_sequence, status');

  if (ordersUpErr) {
    console.error('Failed to update sales orders:', ordersUpErr);
    process.exit(1);
  }
  console.log(`Successfully updated ${ordersUpdated?.length} sales orders to Tahir:`);
  ordersUpdated?.forEach(o => {
    console.log(`  ✓ ${o.order_number} | ${o.customer} | seq: ${o.trip_sequence} | driver: Tahir`);
  });

  // 3. Insert audit log
  await supabase.from('audit_logs').insert({
    table_name: 'trips_v2',
    record_id: TRIP_ID,
    action: 'RESTORE_TAHIR_TRIP',
    changed_by_email: 'antigravity-system-recovery@packsecure.com',
    old_data: { driver_id: MAHADI_ID, note: 'Accidentally moved by operator touch drag' },
    new_data: { driver_id: TAHIR_ID, restored_order_count: TARGET_ORDER_IDS.length }
  });

  console.log('\n=== Step 3: Post-Execution Verification ===');
  // Check Tahir orders count
  const { data: tahirOrders } = await supabase
    .from('sales_orders')
    .select('order_number, status, deadline')
    .eq('driver_id', TAHIR_ID)
    .eq('trip_id', TRIP_ID);

  console.log(`Tahir now has ${tahirOrders?.length} active orders under trip TRIP-260929-120:`);
  tahirOrders?.forEach(o => console.log(`  - ${o.order_number} (${o.status})`));

  // Check Mahadi remaining active orders
  const { data: mahadiOrders } = await supabase
    .from('sales_orders')
    .select('order_number, customer, status, trip_id')
    .eq('driver_id', MAHADI_ID)
    .in('status', ['Planned', 'In Transit', 'Pending Approval']);

  console.log(`\nMahadi now has ${mahadiOrders?.length} remaining active orders:`);
  mahadiOrders?.forEach(o => console.log(`  - ${o.order_number} | ${o.customer} (${o.status})`));

  console.log('\n✅ Plan A Restoration Completed Successfully!');
}

main();
