import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function doIt() {
    console.log("Checking RED 37...");
    let { data: rLogs } = await supabase.from('production_logs_v2').select('*').eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED').eq('machine_id', 'T1.3-M02').gte('created_at', '2026-04-03T00:00:00Z');
    let rQty = rLogs?.reduce((s,o)=>s+o.output_qty,0);
    console.log("RED Production Qty found:", rQty, "Count:", rLogs?.length);
    
    let { data: rLdg } = await supabase.from('stock_ledger_v2').select('*').eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED').eq('event_type','Production').gte('timestamp', '2026-04-03T00:00:00Z');
    let rlQty = rLdg?.reduce((s,o)=>s+o.change_qty,0);
    console.log("RED Ledger Qty found:", rlQty, "Count:", rLdg?.length);

    console.log("Checking GRN 31...");
    let { data: gLogs } = await supabase.from('production_logs_v2').select('*').eq('sku', 'BW-SL-CLR-100Mx25CMx4ROLL-GRN').eq('machine_id', 'T1.3-M02').gte('created_at', '2026-04-02T00:00:00Z');
    let gQty = gLogs?.reduce((s,o)=>s+o.output_qty,0);
    console.log("GRN Production Qty found:", gQty, "Count:", gLogs?.length);
    
    let { data: gLdg } = await supabase.from('stock_ledger_v2').select('*').eq('sku', 'BW-SL-CLR-100Mx25CMx4ROLL-GRN').eq('event_type','Production').gte('timestamp', '2026-04-02T00:00:00Z');
    let glQty = gLdg?.reduce((s,o)=>s+o.change_qty,0);
    console.log("GRN Ledger Qty found:", glQty, "Count:", gLdg?.length);
}
doIt();
