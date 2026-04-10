import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: machines } = await supabase.from('sys_machines_v2').select('*');
  fs.writeFileSync('machines.json', JSON.stringify(machines, null, 2));
  console.log("Written machines.json");

  // check all logs for those wrong SKUs regardless of machine id!
  const { data: pLogs } = await supabase
    .from('production_logs_v2')
    .select('log_id, created_at, machine_id, sku, output_qty')
    .in('sku', ['BW-SL-CLR-100Mx100CMx1ROLL-RED', 'BW-SL-CLR-100Mx25CMx4ROLL-GRN'])
    .gte('created_at', '2026-04-01T00:00:00Z');
    
  fs.writeFileSync('pLogs.json', JSON.stringify(pLogs, null, 2));
  
  const { data: lLogs } = await supabase
    .from('stock_ledger_v2')
    .select('txn_id, timestamp, sku, change_qty, event_type, ref_doc')
    .eq('event_type', 'Production')
    .in('sku', ['BW-SL-CLR-100Mx100CMx1ROLL-RED', 'BW-SL-CLR-100Mx25CMx4ROLL-GRN'])
    .gte('timestamp', '2026-04-01T00:00:00Z');
    
  fs.writeFileSync('lLogs.json', JSON.stringify(lLogs, null, 2));

  console.log("Written pLogs.json and lLogs.json");
}

check();
