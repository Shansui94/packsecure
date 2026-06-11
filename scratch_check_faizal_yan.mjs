import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const supabase = createClient(url, serviceKey);

  console.log("Checking all orders for Faizal and yan...");

  const faizalId = '264e3f4b-99d1-4dff-b768-35f7876598bd';
  const yanId = '06198eb2-7902-4f25-999c-ce00ea0ed037';

  const { data: orders, error: ordersErr } = await supabase
    .from('sales_orders')
    .select('*')
    .or(`driver_id.eq.${faizalId},driver_id.eq.${yanId}`)
    .order('created_at', { ascending: false });

  if (ordersErr) {
    console.error("Orders fetch error:", ordersErr);
    return;
  }

  console.log(`Found ${orders.length} total orders for Faizal and yan.`);

  orders.forEach(o => {
    const driverName = o.driver_id === faizalId ? 'Faizal' : 'yan';
    console.log(`- Driver: ${driverName} | Order: ${o.order_number} | ID: ${o.id} | Status: ${o.status} | Customer: ${o.customer} | Origin: ${o.trip_origin} | OrderDate: ${o.order_date} | Deadline: ${o.deadline} | CreatedAt: ${o.created_at}`);
  });
}

run();
