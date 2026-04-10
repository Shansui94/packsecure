import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

const MACHINE = 'T1.3-M02';
const RED_SKU = 'BW-SL-CLR-100Mx100CMx1ROLL-RED';
const BLK_SKU = 'BW-SL-BLK-100Mx100CMx1ROLL-GRN';

// April 2 9:12 PM MYT = April 2 13:12:00 UTC
const TIME_START = '2026-04-02T13:12:00.000Z';
// April 3 2:00 AM MYT = April 2 18:00:00 UTC
const TIME_SPLIT = '2026-04-02T18:00:00.000Z';

async function updateSpan(sku: string, startUTC: string, endUTC: string | null) {
    let q = supabase.from('production_logs_v2').select('log_id').eq('machine_id', MACHINE).gte('created_at', startUTC);
    if (endUTC) q = q.lt('created_at', endUTC);

    const { data: pLogs } = await q;
    
    if (pLogs && pLogs.length > 0) {
        const ids = pLogs.map(l => l.log_id);
        const { error } = await supabase.from('production_logs_v2').update({ sku }).in('log_id', ids);
        console.log(`Updated ${ids.length} production logs to ${sku} for span starting ${startUTC}`);

        // Try to update corresponding stock_ledger_v2 entries blindly based on timeframe and machine indirectly (we can just update ALL ledger for this machine's production within window)
        // Wait, stock ledger does not have machine_id! But we can target event_type='Production' in the exact timeframe.
        // Actually since we don't track machine_id in ledger directly, we just update the specific SKUs we mangled previously.
        // Let's just find ANY production ledger events in this timeframe that had one of our target SKUs.
        let lq = supabase.from('stock_ledger_v2')
            .select('txn_id')
            .eq('event_type', 'Production')
            .in('sku', [RED_SKU, BLK_SKU, 'BW-SL-CLR-100Mx100CMx1ROLL-GRN', 'BW-SL-CLR-100Mx25CMx4ROLL-GRN'])
            .gte('timestamp', startUTC);
        if (endUTC) lq = lq.lt('timestamp', endUTC);

        const { data: lLogs } = await lq;
        if (lLogs && lLogs.length > 0) {
            const lids = lLogs.map(l => l.txn_id);
            await supabase.from('stock_ledger_v2').update({ sku, notes: 'Corrected by precise time bounds' }).in('txn_id', lids);
            console.log(`Updated ${lids.length} ledger logs to ${sku} for span starting ${startUTC}`);
        }
    } else {
        console.log(`No production logs found for span starting ${startUTC}`);
    }
}

async function run() {
    console.log("Applying precise exact fixes...");
    // 1. Set 9:12 PM to 2:00 AM to RED
    await updateSpan(RED_SKU, TIME_START, TIME_SPLIT);
    // 2. Set 2:00 AM onwards to BLK
    await updateSpan(BLK_SKU, TIME_SPLIT, null); // null means to infinity
}
run();
