import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const supabase = createClient(url, serviceKey);

  console.log("Checking for any active, unassigned sales orders...");
  const { data: orders, error: ordersErr } = await supabase
    .from('sales_orders')
    .select('*')
    .is('driver_id', null)
    .not('status', 'in', '("Delivered","Cancelled")');

  if (ordersErr) {
    console.error("Fetch error:", ordersErr);
    return;
  }

  console.log(`Found ${orders.length} active unassigned orders:`);
  orders.forEach(o => {
    console.log(`- Order: ${o.order_number} | Status: ${o.status} | Origin: ${o.trip_origin} | Deadline: ${o.deadline} | CreatedAt: ${o.created_at}`);
  });
}

run();
