import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
    const { data: logs } = await supabase
        .from('production_logs_v2')
        .select('*')
        .eq('machine_id', 'T1.3-M02')
        .in('sku', ['BW-SL-CLR-100Mx100CMx1ROLL-RED', 'BW-SL-CLR-100Mx25CMx4ROLL-GRN'])
        .gte('created_at', '2026-04-01T00:00:00Z');

    const totalQty = logs?.reduce((sum, item) => sum + item.output_qty, 0) || 0;
    
    fs.writeFileSync('wrong_logs.json', JSON.stringify(logs, null, 2));

    const ids = logs?.map(l => l.log_id) || [];
    
    if (ids.length > 0) {
        await supabase.from('production_logs_v2').update({ sku: 'BW-SL-BLK-100Mx100CMx1ROLL-GRN' }).in('log_id', ids);
    }

    const { data: ledgerLogs } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('event_type', 'Production')
        .in('sku', ['BW-SL-CLR-100Mx100CMx1ROLL-RED', 'BW-SL-CLR-100Mx25CMx4ROLL-GRN'])
        .gte('timestamp', '2026-04-01T00:00:00Z');

    let totalLedgerQty = ledgerLogs?.reduce((sum, item) => sum + item.change_qty, 0) || 0;
    fs.writeFileSync('wrong_ledger.json', JSON.stringify(ledgerLogs, null, 2));

    const ledgerIds = ledgerLogs?.map(l => l.txn_id) || [];
    
    if (ledgerIds.length > 0) {
        await supabase.from('stock_ledger_v2').update({ sku: 'BW-SL-BLK-100Mx100CMx1ROLL-GRN' }).in('txn_id', ledgerIds);
    }
    
    fs.writeFileSync('fix_report.json', JSON.stringify({ 
        totalQtyInLogs: totalQty, 
        totalQtyInLedger: totalLedgerQty, 
        logsChanged: ids.length, 
        ledgerChanged: ledgerIds.length 
    }, null, 2));
}
run();
