import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
    const CORRECT_SKU = 'BW-SL-BLK-100Mx100CMx1ROLL-GRN';
    const WRONG_SKU = 'BW-SL-CLR-100Mx100CMx1ROLL-GRN';
    const TARGET_MACHINE = 'T1.3-M02';

    // 1. Update logs
    const { data: pLogs } = await supabase
        .from('production_logs_v2')
        .select('log_id, output_qty')
        .eq('machine_id', TARGET_MACHINE)
        .eq('sku', WRONG_SKU)
        .gte('created_at', '2026-04-01T00:00:00Z');

    if (pLogs && pLogs.length > 0) {
        const totalQty = pLogs.reduce((s, x) => s + x.output_qty, 0);
        console.log(`Found ${pLogs.length} logs for ${totalQty} units of ${WRONG_SKU}. Updating...`);
        const ids = pLogs.map(l => l.log_id);
        
        await supabase.from('production_logs_v2').update({ sku: CORRECT_SKU }).in('log_id', ids);
        console.log(`Updated production_logs_v2!`);
        
        // 2. Selectively update ledger
        const { data: lLogs } = await supabase
            .from('stock_ledger_v2')
            .select('txn_id, change_qty')
            .eq('sku', WRONG_SKU)
            .eq('event_type', 'Production')
            .gte('timestamp', '2026-04-01T00:00:00Z');

        if (lLogs && lLogs.length > 0) {
            let targetIds: string[] = [];
            let collected = 0;
            for (let l of lLogs) {
                if (collected + l.change_qty <= totalQty) {
                    collected += l.change_qty;
                    targetIds.push(l.txn_id);
                }
            }

            if (targetIds.length > 0) {
                await supabase.from('stock_ledger_v2').update({ sku: CORRECT_SKU, notes: 'Corrected by Admin (Complete Match)' }).in('txn_id', targetIds);
                console.log(`Updated stock_ledger_v2 matching ${collected} units!`);
            }
        }
    } else {
        console.log("No logs found to fix!");
    }
}
run();
