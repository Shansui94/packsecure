import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    const { data, error } = await supabaseAdmin.from('machine_active_products').select('*').eq('machine_id', 'T1.2-M01');
    console.log("machine_active_products:", data || error);

    const { data: skuData } = await supabaseAdmin.from('master_items_v2').select('sku').eq('sku', 'UNKNOWN');
    console.log("UNKNOWN SKU exists in master_items_v2:", skuData);

    // Also check stock ledger for this machine's inserts today
    const { data: slData } = await supabaseAdmin.from('stock_ledger_v2').select('sku, change_qty, timestamp').like('notes', '%T1.2-M01%').order('timestamp', { ascending: false }).limit(5);
    console.log("Recent stock ledger inserts for T1.2-M01:", slData);
}
check();
