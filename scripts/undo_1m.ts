import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

async function undo() {
    console.log("Starting undo process based on wrong_logs.json...");
    
    if (!fs.existsSync('wrong_logs.json')) {
        console.error("wrong_logs.json not found! Cannot undo.");
        return;
    }

    const logs = JSON.parse(fs.readFileSync('wrong_logs.json', 'utf-8'));
    console.log(`Found ${logs.length} logs to restore...`);

    // Group logs by original SKU to do batch updates
    const groups: Record<string, string[]> = {};
    for (const log of logs) {
        if (!groups[log.sku]) groups[log.sku] = [];
        groups[log.sku].push(log.log_id);
    }

    for (const [originalSku, ids] of Object.entries(groups)) {
        console.log(`Restoring ${ids.length} logs back to ${originalSku}...`);
        // Batch update them back to original sku
        // Since Supabase has a limit, we'll chunk the ids just in case 177 is fine though
        const { error } = await supabase
            .from('production_logs_v2')
            .update({ sku: originalSku })
            .in('log_id', ids);
            
        if (error) {
            console.error("Error restoring logs: ", error);
        } else {
            console.log(`✓ Restored batch for ${originalSku}`);
        }
    }

    console.log("Checking ledger recovery...");
    if (fs.existsSync('wrong_ledger.json')) {
        const ledgers = JSON.parse(fs.readFileSync('wrong_ledger.json', 'utf-8'));
        if (ledgers && ledgers.length > 0) {
            console.log(`Found ${ledgers.length} ledger logs to restore...`);
            const lGroups: Record<string, string[]> = {};
            for (const log of ledgers) {
                if (!lGroups[log.sku]) lGroups[log.sku] = [];
                lGroups[log.sku].push(log.txn_id);
            }
            for (const [originalSku, ids] of Object.entries(lGroups)) {
                await supabase
                    .from('stock_ledger_v2')
                    .update({ sku: originalSku, notes: 'Restored from Undo' })
                    .in('txn_id', ids);
                console.log(`✓ Restored ledger batch for ${originalSku}`);
            }
        } else {
            console.log("No ledger entries were modified previously, nothing to restore for ledger.");
        }
    }

    console.log("Undo Complete!");
}

undo();
