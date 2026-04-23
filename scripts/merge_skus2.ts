import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Force load exactly from .env
const envPath = path.resolve(process.cwd(), '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) {
    process.env[k] = envConfig[k];
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // 1. Let's MERGE the old DL-HITAM-FULL *SKU* into the new RED one too!
    const survivorSku = 'BW-DL-BLK-100Mx100CMx1ROLL-RED';
    const oldSku = 'DL-HITAM-FULL';

    console.log(`\nChecking Old SKU: ${oldSku} merging into ${survivorSku}...`);

    // 2. Production Logs
    const { data: logs } = await supabase.from('production_logs_v2').update({ sku: survivorSku }).eq('sku', oldSku).select('log_id');
    console.log(`Migrated ${logs?.length || 0} production logs from old SKU.`);

    // 3. Stock Ledger
    const { data: ledger } = await supabase.from('stock_ledger_v2').update({ sku: survivorSku }).eq('sku', oldSku).select('txn_id');
    console.log(`Migrated ${ledger?.length || 0} stock ledger entries from old SKU.`);

    // 4. Production Schedule
    const { data: sched } = await supabase.from('production_schedule').update({ sku: survivorSku }).eq('sku', oldSku).select('id');
    console.log(`Migrated ${sched?.length || 0} schedule tasks from old SKU.`);

    // 6. Delete or Obsolete Victim
    await supabase.from('master_items_v2').update({ status: 'Obsolete' }).eq('sku', oldSku);
    console.log('Successfully set old SKU to Obsolete.');
}

main().catch(console.error);
