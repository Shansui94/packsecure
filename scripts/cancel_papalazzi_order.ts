import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ORDER_ID = 'cb0224df-afec-4c09-aa0b-9fe9a2b6f10f'; // OPM2609-1110
const TRIP_ID = '9cd56c2f-433c-4d99-a771-421bde740b38';  // TRIP-260928-375
const YASHIN_ID = 'f1e0b372-4d34-46c2-a3ab-3497688f1899';

async function main() {
  console.log('=== Step 1: Pre-Execution Verification ===');
  const { data: orderBefore } = await supabase
    .from('sales_orders')
    .select('id, order_number, customer, status, notes, trip_id, driver_id')
    .eq('id', ORDER_ID)
    .single();

  console.log('Order to cancel:', orderBefore);

  const { data: tripBefore } = await supabase
    .from('trips_v2')
    .select('id, trip_number, status, driver_id')
    .eq('id', TRIP_ID)
    .single();

  console.log('Trip to cancel:', tripBefore);

  console.log('\n=== Step 2: Cancelling Order & Trip ===');
  // 1. Cancel order
  const updatedNotes = `${orderBefore?.notes || ''}\n[30/09 Cancelled: tak sempat hantar semalam, batal]`;
  const { data: orderUpdated, error: orderErr } = await supabase
    .from('sales_orders')
    .update({
      status: 'Cancelled',
      notes: updatedNotes,
      updated_at: new Date().toISOString()
    })
    .eq('id', ORDER_ID)
    .select();

  if (orderErr) {
    console.error('Failed to cancel order:', orderErr);
    process.exit(1);
  }
  console.log('Order cancelled successfully:', orderUpdated);

  // 2. Cancel trip in trips_v2
  const { data: tripUpdated, error: tripErr } = await supabase
    .from('trips_v2')
    .update({
      status: 'Cancelled',
      completed_at: new Date().toISOString()
    })
    .eq('id', TRIP_ID)
    .select();

  if (tripErr) {
    console.error('Failed to cancel trip:', tripErr);
    process.exit(1);
  }
  console.log('Trip cancelled successfully:', tripUpdated);

  // 3. Insert audit log
  await supabase.from('audit_logs').insert({
    table_name: 'sales_orders',
    record_id: ORDER_ID,
    action: 'CANCEL_ORDER_TAK_SEMPAT',
    changed_by_email: 'antigravity-system-recovery@packsecure.com',
    old_data: { status: orderBefore?.status, trip_id: TRIP_ID },
    new_data: { status: 'Cancelled', reason: 'Tak sempat hantar semalam / Batal' }
  });

  console.log('\n=== Step 3: Checking Yashin Active Trips Now ===');
  // Check what trips Yashin has now
  const { data: yashinOrders } = await supabase
    .from('sales_orders')
    .select('id, order_number, customer, status, trip_id, trip_sequence, deadline')
    .eq('driver_id', YASHIN_ID)
    .neq('status', 'Cancelled')
    .neq('status', 'Delivered')
    .order('deadline', { ascending: false });

  console.log(`Yashin active uncompleted orders count: ${yashinOrders?.length}`);
  yashinOrders?.forEach(o => {
    console.log(`  - [${o.status}] ${o.order_number} | ${o.customer} | Trip: ${o.trip_id} | seq: ${o.trip_sequence}`);
  });

  console.log('\n✅ Yashin today trip (Penang) should now be 100% UNLOCKED in app!');
}

main();
