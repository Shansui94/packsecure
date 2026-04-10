import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    const { data: logs } = await supabase
        .from('production_logs_v2')
        .select('sku, output_qty, created_at')
        .eq('machine_id', 'T1.3-M02')
        .gte('created_at', '2026-04-02T00:00:00Z');

    const agg: Record<string, number> = {};
    for (const l of logs || []) {
        const d = new Date(l.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
        const key = `${d} | ${l.sku}`;
        agg[key] = (agg[key] || 0) + l.output_qty;
    }
    
    console.log("=== T1.3-M02 Production Logs (past 2 days) ===");
    console.log(agg);

}
check();
