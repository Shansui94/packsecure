import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const supabase = createClient(url, serviceKey);

  console.log("Checking all users to map IDs to names...");
  const { data: users, error: usersErr } = await supabase
    .from('users_public')
    .select('id, name');

  if (usersErr) {
    console.error("users_public fetch error:", usersErr);
    return;
  }

  const driverMap = {};
  users.forEach(u => {
    driverMap[u.id] = u.name;
  });

  console.log("Querying EVERY single sales order that is NOT Delivered or Cancelled...");
  const { data: orders, error: ordersErr } = await supabase
    .from('sales_orders')
    .select('*')
    .not('status', 'in', '("Delivered","Cancelled")')
    .order('created_at', { ascending: false });

  if (ordersErr) {
    console.error("Orders fetch error:", ordersErr);
    return;
  }

  console.log(`\n--- ALL UNCOMPLETED/ACTIVE ORDERS IN THE DATABASE (${orders.length} total) ---`);
  
  if (orders.length === 0) {
    console.log("There are no active/uncompleted orders in the database!");
    return;
  }

  orders.forEach((o, index) => {
    const driverName = o.driver_id ? (driverMap[o.driver_id] || `Unknown (${o.driver_id})`) : 'Unassigned';
    console.log(`${index + 1}. Order: ${o.order_number} | Driver: ${driverName} | Status: ${o.status} | Origin: ${o.trip_origin} | Destination: ${o.trip_destination} | Date: ${o.order_date} | Deadline: ${o.deadline} | CreatedAt: ${o.created_at}`);
  });
}

run();
