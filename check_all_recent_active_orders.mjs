import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const supabase = createClient(url, serviceKey);

  let output = "=== DRIVER TRIP AUDIT LOG ===\n\n";

  output += "Fetching all drivers from users_public to map IDs to names...\n";
  const { data: users, error: usersErr } = await supabase
    .from('users_public')
    .select('id, name, role');

  if (usersErr) {
    output += `users_public fetch error: ${JSON.stringify(usersErr)}\n`;
    fs.writeFileSync('recent_orders_audit.txt', output);
    return;
  }

  const driverMap = {};
  users.forEach(u => {
    driverMap[u.id] = u.name;
  });

  output += "Fetching all orders since 2026-06-01 or those that are not Delivered/Cancelled...\n";
  const { data: orders, error: ordersErr } = await supabase
    .from('sales_orders')
    .select('*')
    .or('created_at.gte.2026-06-01T00:00:00Z,status.neq.Delivered')
    .order('created_at', { ascending: false });

  if (ordersErr) {
    output += `Orders fetch error: ${JSON.stringify(ordersErr)}\n`;
    fs.writeFileSync('recent_orders_audit.txt', output);
    return;
  }

  // Filter out Cancelled status if they are old, but keep recent ones
  const filteredOrders = orders.filter(o => {
    const isRecent = o.created_at && o.created_at >= '2026-06-01';
    const isActive = o.status !== 'Delivered' && o.status !== 'Cancelled';
    return isRecent || isActive;
  });

  output += `Found ${filteredOrders.length} matching active/recent orders.\n`;

  // Group by driver
  const grouped = {};
  filteredOrders.forEach(o => {
    const driverName = o.driver_id ? (driverMap[o.driver_id] || `Unknown Driver (${o.driver_id})`) : 'Unassigned';
    if (!grouped[driverName]) {
      grouped[driverName] = [];
    }
    grouped[driverName].push(o);
  });

  for (const [driverName, driverOrders] of Object.entries(grouped)) {
    output += `\nDriver: ${driverName} (${driverOrders.length} orders)\n`;
    driverOrders.forEach(o => {
      output += `  - Order: ${o.order_number} | ID: ${o.id} | Status: ${o.status} | Origin: ${o.trip_origin} | Destination: ${o.trip_destination} | Date: ${o.order_date} | Deadline: ${o.deadline} | CreatedAt: ${o.created_at}\n`;
    });
  }

  fs.writeFileSync('recent_orders_audit.txt', output);
  console.log("Successfully wrote audit log to recent_orders_audit.txt");
}

run();
