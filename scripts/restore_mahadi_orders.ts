import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAHADI_ID = 'cc2dc059-b4ea-4457-bd40-bca51eb25ec6';
const ORDER_1_ID = '9aa5e0f5-f174-4545-93d8-7efc017e1a46'; // OPM2609-0966
const ORDER_2_ID = '03251ffe-421a-4eee-9e8a-eaa602d74e1f'; // OPM2609-0965

async function main() {
  console.log('=== Step 1: Pre-Execution State ===');
  const { data: ordersBefore, error: errBefore } = await supabase
    .from('sales_orders')
    .select('id, order_number, customer, status, driver_id, trip_sequence, items, notes')
    .in('id', [ORDER_1_ID, ORDER_2_ID]);

  if (errBefore) {
    console.error('Error fetching orders:', errBefore);
    process.exit(1);
  }
  console.log('Orders before:', ordersBefore);

  console.log('\n=== Step 2: Restoring Orders to Mahadi ===');
  // Order 1: OPM2609-0966 (1 x CUKUPP-B20)
  const { error: err1 } = await supabase
    .from('sales_orders')
    .update({
      driver_id: MAHADI_ID,
      trip_sequence: 999,
      status: 'Delivered',
      items: [
        {
          sku: 'CUKUPP-B20',
          product: 'CUKUPP-B20',
          quantity: 1,
          packaging: 'UNIT',
          sourceLocation: 'Nilai'
        }
      ],
      updated_at: new Date().toISOString()
    })
    .eq('id', ORDER_1_ID);

  if (err1) {
    console.error('Failed to update Order 1:', err1);
    process.exit(1);
  }
  console.log('✓ Order 1 (OPM2609-0966) restored to Mahadi');

  // Order 2: OPM2609-0965 (10 x MERAH)
  const { error: err2 } = await supabase
    .from('sales_orders')
    .update({
      driver_id: MAHADI_ID,
      trip_sequence: 999,
      status: 'Delivered',
      items: [
        {
          sku: 'BW-SL-CLR-100Mx100CMx1ROLL-RED',
          product: 'MERAH',
          quantity: 10,
          packaging: 'UNIT',
          sourceLocation: 'Nilai'
        }
      ],
      updated_at: new Date().toISOString()
    })
    .eq('id', ORDER_2_ID);

  if (err2) {
    console.error('Failed to update Order 2:', err2);
    process.exit(1);
  }
  console.log('✓ Order 2 (OPM2609-0965) restored to Mahadi');

  // Audit log
  await supabase.from('audit_logs').insert([
    {
      table_name: 'sales_orders',
      record_id: ORDER_1_ID,
      action: 'RESTORE_MAHADI_SELF_PICKUP',
      changed_by_email: 'antigravity-system-recovery@packsecure.com',
      old_data: { driver_id: null, note: 'Accidentally moved to unassigned by self-pickup edit bug' },
      new_data: { driver_id: MAHADI_ID, restored: true }
    },
    {
      table_name: 'sales_orders',
      record_id: ORDER_2_ID,
      action: 'RESTORE_MAHADI_SELF_PICKUP',
      changed_by_email: 'antigravity-system-recovery@packsecure.com',
      old_data: { driver_id: null, note: 'Accidentally moved to unassigned by self-pickup edit bug' },
      new_data: { driver_id: MAHADI_ID, restored: true }
    }
  ]);
  console.log('✓ Audit logs recorded.');

  console.log('\n=== Step 3: Post-Execution Verification ===');
  const { data: ordersAfter } = await supabase
    .from('sales_orders')
    .select('id, order_number, customer, status, driver_id, trip_sequence, items')
    .in('id', [ORDER_1_ID, ORDER_2_ID]);

  console.log('Orders after restoration:', ordersAfter);
  console.log('\n✅ Successfully restored both orders back to Mahadi!');
}

main();
