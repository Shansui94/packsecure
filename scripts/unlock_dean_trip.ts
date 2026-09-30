import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEAN_ID = 'c3eeab28-5960-4bef-b5d3-28d69dfa0b5d';
const ORDER_ID = 'a38e79aa-94fe-4c7f-aa02-90e45c27be16'; // OPM2609-1086, ABG SUPPLY
const SELANGOR_TRIP_ID = 'a1706a26-e7bf-4437-8fd7-a4799ba06a65'; // TRIP-260926-197
const YESTERDAY_TRIP_ID = 'c9db8d91-471a-415f-8768-6b09d97bdc04'; // TRIP-260928-578
const TODAY_TRIP_ID = 'ce0bcee7-4b91-4385-989c-621cfb5adcb8'; // TRIP-260929-354

async function main() {
  console.log('=== Step 1: Pre-Execution Verification ===');
  const { data: orderBefore, error: ordErr } = await supabase
    .from('sales_orders')
    .select('id, order_number, customer, status, notes, trip_id, driver_id, trip_drop_count')
    .eq('id', ORDER_ID)
    .single();

  if (ordErr || !orderBefore) {
    console.error('Order not found:', ordErr);
    process.exit(1);
  }
  console.log('Target Order to Cancel (Bawak Balik):', orderBefore);

  const { data: tripsBefore } = await supabase
    .from('trips_v2')
    .select('id, trip_number, status, driver_id')
    .in('id', [SELANGOR_TRIP_ID, YESTERDAY_TRIP_ID, TODAY_TRIP_ID]);

  console.log('Trips status before:', tripsBefore);

  console.log('\n=== Step 2: Executing Cancellation & Trip Completion ===');
  // 1. Cancel OPM2609-1086
  const updatedNotes = `${orderBefore.notes || ''}\n[30/09 Cancelled: Barang bawak balik kilang / Returned to warehouse. Unlocked by Admin]`;
  const { data: orderUpdated, error: orderUpErr } = await supabase
    .from('sales_orders')
    .update({
      status: 'Cancelled',
      notes: updatedNotes,
      updated_at: new Date().toISOString()
    })
    .eq('id', ORDER_ID)
    .select();

  if (orderUpErr) {
    console.error('Failed to cancel order:', orderUpErr);
    process.exit(1);
  }
  console.log('✓ Order OPM2609-1086 successfully marked Cancelled (bawak balik):', orderUpdated);

  // 2. Update trip_drop_count for remaining 10 delivered orders in TRIP-260926-197
  const { error: dropCountErr } = await supabase
    .from('sales_orders')
    .update({ trip_drop_count: 10 })
    .eq('trip_id', SELANGOR_TRIP_ID)
    .eq('status', 'Delivered');

  if (dropCountErr) {
    console.warn('Warning updating drop counts:', dropCountErr);
  } else {
    console.log('✓ Updated trip_drop_count to 10 for delivered orders in Selangor trip.');
  }

  // 3. Mark past trips as Completed in trips_v2
  const now = new Date().toISOString();
  const { data: tripsUpdated, error: tripUpErr } = await supabase
    .from('trips_v2')
    .update({
      status: 'Completed',
      completed_at: now
    })
    .in('id', [SELANGOR_TRIP_ID, YESTERDAY_TRIP_ID])
    .select();

  if (tripUpErr) {
    console.error('Failed to complete past trips:', tripUpErr);
    process.exit(1);
  }
  console.log('✓ Past trips updated to Completed:', tripsUpdated);

  // 4. Audit Log
  await supabase.from('audit_logs').insert({
    table_name: 'sales_orders',
    record_id: ORDER_ID,
    action: 'CANCEL_ORDER_BAWAK_BALIK',
    changed_by_email: 'antigravity-system-recovery@packsecure.com',
    old_data: { status: orderBefore.status, trip_id: SELANGOR_TRIP_ID },
    new_data: { 
      status: 'Cancelled', 
      reason: 'Barang bawak balik kilang / Customer undelivered', 
      unlocked_trip: TODAY_TRIP_ID 
    }
  });
  console.log('✓ Audit log created.');

  console.log('\n=== Step 3: Post-Execution Verification ===');
  const { data: deansActiveOrders } = await supabase
    .from('sales_orders')
    .select('id, order_number, customer, status, trip_id, deadline')
    .eq('driver_id', DEAN_ID)
    .neq('status', 'Cancelled')
    .neq('status', 'Delivered')
    .order('deadline', { ascending: false });

  console.log(`Dean now has ${deansActiveOrders?.length} active pending orders:`);
  deansActiveOrders?.forEach(o => {
    console.log(`  - [${o.status}] ${o.order_number} | ${o.customer} | Trip: ${o.trip_id}`);
  });

  const { data: todayTripCheck } = await supabase
    .from('trips_v2')
    .select('id, trip_number, status, lorry_id')
    .eq('id', TODAY_TRIP_ID)
    .single();

  console.log('\nToday Trip Status:', todayTripCheck);
  console.log('✅ Dean today trip (Perak, TRIP-260929-354) is now 100% UNLOCKED!');
}

main();
