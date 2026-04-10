import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
    const todayISO = new Date();
    todayISO.setHours(0, 0, 0, 0); // Start of today

    let { data, error } = await supabase
        .from('production_logs_v2')
        .select('machine_id, log_id, created_at')
        .eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-GRN')
        .gte('created_at', todayISO.toISOString())
        .order('created_at', { ascending: false });

    console.log(`Found ${data?.length} logs today for Clear 100cm Green.`);
    if (data && data.length > 0) {
        console.log("Machines involved:");
        console.log([...new Set(data.map(d => d.machine_id))]);
        console.log("\nSample logs:");
        console.log(data.slice(0, 3));
    }
}

run();
