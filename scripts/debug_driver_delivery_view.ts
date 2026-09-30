import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const yanId = '06198eb2-7902-4f25-999c-ce00ea0ed037';
  const tahirId = '1fcff5ee-f671-4b9a-9749-4745921093e8';

  for (const [name, driverId] of [['Yan (9826)', yanId], ['Tahir (9524)', tahirId]]) {
    console.log(`\n=== Checking Driver: ${name} ===`);
    const { data: orders } = await supabase
      .from('sales_orders')
      .select('id, order_number, customer, status, trip_id, deadline, order_date, trip_origin, delivery_address, notes')
      .eq('driver_id', driverId)
      .neq('status', 'Cancelled')
      .order('deadline', { ascending: false });

    console.log(`Total orders returned: ${orders?.length}`);
    const uncompleted = orders?.filter(o => o.status !== 'Delivered') || [];
    console.log(`Uncompleted orders (${uncompleted.length}):`);
    uncompleted.forEach(o => {
      console.log(`  - [${o.status}] ${o.order_number} | ${o.customer} | Date: ${o.deadline?.slice(0, 10)} | Trip: ${o.trip_id} | ${o.notes?.slice(0, 40)}`);
    });
  }
}

main();
