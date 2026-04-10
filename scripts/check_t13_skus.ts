import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Looking for production logs of T1-M03 on Apr 2 and Apr 3...");
  
  const { data: logs, error } = await supabase
    .from('production_logs_v2')
    .select('*')
    .eq('machine_id', 'T1-M03')
    .in('sku', [
      'BW-SL-CLR-100Mx100CMx1ROLL-RED',
      'BW-SL-CLR-100Mx25CMx4ROLL-GRN',
      'BW-SL-BLK-100Mx100CMx1ROLL-GRN'
    ])
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log(`Found ${logs.length} logs for T1-M03`);
  
  // Aggregate by date and sku
  const agg: Record<string, number> = {};
  logs.forEach(l => {
    const d = new Date(l.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
    const key = `${d} | ${l.sku}`;
    agg[key] = (agg[key] || 0) + Number(l.output_qty);
  });
  
  console.table(agg);

  // Check ledger entries for T1-M03
  const { data: ledger } = await supabase
    .from('stock_ledger_v2')
    .select('sku, change_qty, timestamp, event_type, ref_doc')
    .eq('event_type', 'Production')
    .gte('timestamp', '2026-04-02T00:00:00.000Z')
    .in('sku', [
      'BW-SL-CLR-100Mx100CMx1ROLL-RED',
      'BW-SL-CLR-100Mx25CMx4ROLL-GRN',
      'BW-SL-BLK-100Mx100CMx1ROLL-GRN'
    ])
    .order('timestamp', { ascending: false })
    .limit(10);
    
  console.log("Recent Ledger Entries for these SKUs:");
  console.log(ledger);
}

check();
