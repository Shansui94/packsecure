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
    const survivorSku = 'BW-DL-BLK-100Mx100CMx1ROLL-RED';
    const victimSku = 'BW-DL-BLK-100Mx100CMx1ROLL-GRN'; // To be merged into survivor
    const newName = 'DL-HITAM-FULL';

    console.log(`Starting Data Merge...`);
    console.log(`Survivor: ${survivorSku}`);
    console.log(`Victim: ${victimSku}`);
    console.log(`Will rename survivor to: ${newName}`);

    // Let's also merge DL-HITAM-FULL (the old SKU) if it exists and they want it merged.
    // Wait, the user ONLY specified GRN as the sacrifice. So I will ONLY sacrifice GRN for now.

    // 1. Rename the survivor
    console.log(`\n[1] Updating Name of Survivor...`);
    const { error: errName } = await supabase.from('master_items_v2').update({ name: newName }).eq('sku', survivorSku);
    if (errName) console.error('Error renaming:', errName);
    else console.log('Successfully renamed survivor!');

    // 2. Production Logs
    console.log(`\n[2] Merging Production Logs...`);
    const { data: logs, error: errLogs } = await supabase.from('production_logs_v2').update({ sku: survivorSku }).eq('sku', victimSku).select('log_id');
    if (errLogs) console.error('Error migrating logs:', errLogs);
    else console.log(`Migrated ${logs?.length || 0} production logs.`);

    // 3. Stock Ledger
    console.log(`\n[3] Merging Stock Ledger Entries...`);
    const { data: ledger, error: errLedger } = await supabase.from('stock_ledger_v2').update({ sku: survivorSku }).eq('sku', victimSku).select('txn_id');
    if (errLedger) console.error('Error migrating ledger:', errLedger);
    else console.log(`Migrated ${ledger?.length || 0} stock ledger entries.`);

    // 4. Production Schedule
    console.log(`\n[4] Merging Production Schedule...`);
    const { data: sched, error: errSched } = await supabase.from('production_schedule').update({ sku: survivorSku }).eq('sku', victimSku).select('id');
    if (errSched) console.error('Error migrating schedule:', errSched);
    else console.log(`Migrated ${sched?.length || 0} schedule tasks.`);

    // 5. Active Products (Machine Active Status)
    console.log(`\n[5] Merging Active Machine Status...`);
    const { data: active, error: errAct } = await supabase.from('machine_active_products').update({ product_sku: survivorSku }).eq('product_sku', victimSku).select('machine_id');
    if (errAct && errAct.code !== '23505') console.error('Error migrating active products:', errAct); // 23505 is unique constraint, ignore if both run same 
    else console.log(`Migrated ${active?.length || 0} active machines.`);

    // 6. Delete or Obsolete Victim
    console.log(`\n[6] Setting Victim to Obsolete...`);
    const { error: errObs } = await supabase.from('master_items_v2').update({ status: 'Obsolete' }).eq('sku', victimSku);
    if (errObs) console.error('Error making obsolete:', errObs);
    else console.log('Successfully set victim to Obsolete.');

    console.log(`\nMERGE COMPLETE!`);
}

main().catch(console.error);
