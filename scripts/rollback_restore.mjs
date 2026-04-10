import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceKeyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const key = serviceKeyMatch[1].trim();
const supabase = createClient(supabaseUrl, key);

async function rollback() {
    // Audit timeline: 2026-04-04 00:00 (Malaysian Time => 2026-04-03 16:00 UTC)
    // The user performed "Audit" events around this time. So we only want to keep Auto-Restored ones where the DO deadline was ON or AFTER 2026-04-04.
    // Basically, any DO that was older than 2026-04-04 should NOT have been auto-restored, because the Audit swallowed it.
    
    // We can delete all restored records that have a timestamp older than '2026-04-04T00:00:00'
    const { data: toDelete, error: fetchError } = await supabase
        .from('stock_ledger_v2')
        .select('txn_id')
        .eq('notes', 'System Auto-Restored DO Delivery')
        .lt('timestamp', '2026-04-04T00:00:00Z');

    if (fetchError) {
        console.error("Fetch error:", fetchError);
        return;
    }

    console.log(`Found ${toDelete.length} records that were auto-restored BEFORE the Audit boundary (2026-04-04). Rolling them back...`);

    if (toDelete.length > 0) {
        // Chunk deletions
        let deletedCount = 0;
        const chunkSize = 100;
        for (let i = 0; i < toDelete.length; i += chunkSize) {
            const chunk = toDelete.slice(i, i + chunkSize).map(r => r.txn_id);
            const { error: delError } = await supabase
                .from('stock_ledger_v2')
                .delete()
                .in('txn_id', chunk);

            if (delError) {
                console.error("Delete error:", delError);
            } else {
                deletedCount += chunk.length;
            }
        }
        console.log(`Successfully rolled back (deleted) ${deletedCount} records.`);
    }
}

rollback();
