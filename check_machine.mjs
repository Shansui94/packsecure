import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    const { data, error } = await supabaseAdmin.from('sys_machines_v2').select('machine_id, factory_id').eq('machine_id', 'T1.2-M01');
    console.log("machine:", data || error);

    const { data: slData } = await supabaseAdmin.from('stock_ledger_v2').select('loc_id').eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED').order('timestamp', { ascending: false }).limit(1);
    console.log("last stock ledger loc_id:", slData);
}
check();
