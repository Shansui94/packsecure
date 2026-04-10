import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

async function hunt() {
    const { data: logs } = await supabase
        .from('production_logs_v2')
        .select('machine_id, sku, output_qty, created_at')
        .in('sku', ['BW-SL-CLR-100Mx100CMx1ROLL-RED', 'BW-SL-CLR-100Mx25CMx4ROLL-GRN'])
        .gte('created_at', '2026-04-01T00:00:00Z');

    const agg: Record<string, number> = {};
    for (const log of logs || []) {
        const d = new Date(log.created_at);
        d.setHours(d.getHours() + 8); // UTC+8
        const dateStr = d.toISOString().split('T')[0];
        
        const key = `${dateStr} | ${log.machine_id} | ${log.sku}`;
        agg[key] = (agg[key] || 0) + log.output_qty;
    }
    
    fs.writeFileSync('hunt_result.json', JSON.stringify(agg, null, 2));
    console.log("Written hunt_result.json");
}
hunt();
