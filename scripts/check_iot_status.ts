import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStatus() {
  console.log("--- Checking Recent Production Logs (Last 1 Hour) ---");
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  console.log("\n--- Checking Recent Production Logs ---");
  const { data: logs, error: logsError } = await supabase
    .from('production_logs_v2')
    .select('log_id, sku, machine_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (logsError) console.error(logsError);
  else console.log(logs);

  console.log("\n--- Checking for N1-M01 logs ---");
  const { data: nLogs, error: nError } = await supabase
    .from('production_logs_v2')
    .select('log_id, sku, machine_id, created_at')
    .eq('machine_id', 'N1-M01')
    .order('created_at', { ascending: false })
    .limit(5);

  if (nError) console.error(nError);
  else console.log(nLogs);

  console.log("\n--- Checking iot_device_configs Table ---");
  const { data: iot, error: iotError } = await supabase
    .from('iot_device_configs')
    .select('*')
    .order('last_heartbeat', { ascending: false });
    
  if (iotError) console.error(iotError);
  else console.log(iot);
}

checkStatus();
