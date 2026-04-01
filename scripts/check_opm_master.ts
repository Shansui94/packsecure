import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
    let out = "--- Active Products Map ---\n";
    const { data: ap } = await supabase.from('machine_active_products').select('*');
    out += JSON.stringify(ap, null, 2) + "\n";

    out += "--- Recent Production Logs (V2) ---\n";
    const { data: logs } = await supabase.from('production_logs_v2').select('*').order('created_at', { ascending: false }).limit(20);
    out += JSON.stringify(logs, null, 2) + "\n";

    out += "--- Recent Stock Ledger (V2) ---\n";
    const { data: stock } = await supabase.from('stock_ledger_v2').select('*').order('timestamp', { ascending: false }).limit(20);
    out += JSON.stringify(stock, null, 2) + "\n";

    fs.writeFileSync('output.json', out, 'utf8');
}

check().catch(console.error);
