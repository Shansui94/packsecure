import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const orderNumber = 'DO-DRIVER-260610-001';
  console.log(`Searching for order: ${orderNumber}`);
  
  const { data: order, error: fetchErr } = await supabase
    .from('sales_orders')
    .select('*')
    .eq('order_number', orderNumber)
    .single();

  if (fetchErr) {
    console.error("Error fetching order:", fetchErr);
    return;
  }

  console.log("Current Order Details:", {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    pod_photo_url: order.pod_photo_url,
    pod_timestamp: order.pod_timestamp,
    notes: order.notes,
    proof_of_load_url: order.proof_of_load_url
  });

  console.log("Resetting order back to 'Loaded' status, clearing POD photos, notes, and timestamp...");

  const { data: resetOrder, error: updateErr } = await supabase
    .from('sales_orders')
    .update({
      status: 'Loaded',
      pod_photo_url: null,
      pod_timestamp: null,
      notes: null,
      // Keep proof_of_load_url so it doesn't require reloading from lorry, or reset that too if needed?
      // Usually keeping it is better, but let's check notes. We can set notes to null or empty.
    })
    .eq('id', order.id)
    .select();

  if (updateErr) {
    console.error("Error resetting order:", updateErr);
  } else {
    console.log("Reset successful! New order details:", resetOrder[0]);
  }
}

run();
