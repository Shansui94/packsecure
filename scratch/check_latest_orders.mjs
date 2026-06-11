import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

async function run() {
  const supabase = createClient(url, serviceKey);

  console.log("Fetching latest 5 updated sales orders...");
  const { data, error } = await supabase
    .from('sales_orders')
    .select('id, order_number, status, notes, updated_at, driver_id, proof_of_load_url, pod_photo_url')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching orders:", error);
  } else {
    console.log("Latest Orders:", JSON.stringify(data, null, 2));
  }
}

run();
