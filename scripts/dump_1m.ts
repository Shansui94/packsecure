import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

async function dump() {
    const { data: logs } = await supabase
        .from('production_logs_v2')
        .select('*')
        .eq('machine_id', 'T1.3-M02')
        .gte('created_at', '2026-04-02T00:00:00Z');

    let sum = 0;
    for(let l of logs || []) {
        console.log(`${l.created_at} | ${l.sku} | ${l.output_qty}`);
    }
}
dump();
