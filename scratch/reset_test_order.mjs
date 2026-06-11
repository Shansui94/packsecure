import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

async function run() {
  const supabase = createClient(url, serviceKey);

  console.log("Resetting order DO-DRIVER-260608-001 to New status...");
  const { data, error } = await supabase
    .from('sales_orders')
    .update({
      status: 'New',
      proof_of_load_url: null,
      pod_photo_url: null,
      pod_timestamp: null,
      notes: ''
    })
    .eq('order_number', 'DO-DRIVER-260608-001')
    .select();

  if (error) {
    console.error("Error resetting order:", error);
  } else {
    console.log("Order reset successful. Current state:", JSON.stringify(data, null, 2));
  }
}

run();
