import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TARGET_TRIP_ID = '394e3969-21c5-4796-870a-17600164b5b6';

async function main() {
  console.log('=== Step 1: Pre-execution check ===');
  const { data: beforeOrders, error: fetchErr } = await supabase
    .from('sales_orders')
    .select('id, order_number, customer, delivery_address, trip_drop_count, trip_id')
    .eq('trip_id', TARGET_TRIP_ID);

  if (fetchErr || !beforeOrders || beforeOrders.length === 0) {
    console.error('Failed to find orders for trip:', fetchErr);
    process.exit(1);
  }

  console.log(`Found ${beforeOrders.length} orders for trip ${TARGET_TRIP_ID}:`);
  beforeOrders.forEach(o => {
    console.log(` - ${o.order_number} (${o.customer}): trip_drop_count = ${o.trip_drop_count}`);
  });

  console.log('\n=== Step 2: Updating trip_drop_count to 1 ===');
  const { data: updatedOrders, error: updateErr } = await supabase
    .from('sales_orders')
    .update({ trip_drop_count: 1 })
    .eq('trip_id', TARGET_TRIP_ID)
    .select('id, order_number, customer, trip_drop_count');

  if (updateErr) {
    console.error('Update failed:', updateErr);
    process.exit(1);
  }

  console.log('Successfully updated orders:');
  console.log(updatedOrders);
  console.log('\n=== Fix complete! ===');
}

main();
