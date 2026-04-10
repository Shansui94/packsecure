import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

async function huntLedger() {
    const { data: logs } = await supabase
        .from('stock_ledger_v2')
        .select('sku, change_qty, timestamp, event_type')
        .eq('event_type', 'Production')
        .in('sku', ['BW-SL-CLR-100Mx100CMx1ROLL-RED', 'BW-SL-CLR-100Mx25CMx4ROLL-GRN', 'BW-SL-BLK-100Mx100CMx1ROLL-GRN'])
        .gte('timestamp', '2026-04-01T00:00:00Z');

    const agg: Record<string, number> = {};
    for (const log of logs || []) {
        const d = new Date(log.timestamp);
        d.setHours(d.getHours() + 8); // UTC+8
        const dateStr = d.toISOString().split('T')[0];
        
        const key = `${dateStr} | ${log.sku}`;
        agg[key] = (agg[key] || 0) + log.change_qty;
    }
    
    fs.writeFileSync('hunt_ledger.json', JSON.stringify(agg, null, 2));
    console.log("Written hunt_ledger.json");
}
huntLedger();
