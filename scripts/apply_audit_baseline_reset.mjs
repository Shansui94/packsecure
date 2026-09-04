import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('Missing Supabase Service Role Key or URL in .env');
    process.exit(1);
}

const supabase = createClient(url, key);

async function applyBaselineReset() {
    console.log('==========================================');
    console.log('🚀 STARTING AUDIT BASELINE RESET (2026-09-04)');
    console.log('==========================================\n');

    // 1. Fetch all negative inventory records from view
    const { data: negs, error: negErr } = await supabase
        .from('v2_inventory_view')
        .select('sku, loc_id, current_stock')
        .lt('current_stock', 0);

    if (negErr) {
        console.error('Error querying negative balances:', negErr);
        process.exit(1);
    }

    // 2. Fetch UNKNOWN-BUBBLEWRAP balances
    const { data: ubs, error: ubErr } = await supabase
        .from('v2_inventory_view')
        .select('sku, loc_id, current_stock')
        .eq('sku', 'UNKNOWN-BUBBLEWRAP');

    if (ubErr) {
        console.error('Error querying UNKNOWN-BUBBLEWRAP:', ubErr);
        process.exit(1);
    }

    const adjustments = [];
    const now = new Date().toISOString();

    // Process negative stock corrections
    for (const row of negs) {
        // Avoid duplicate adjustment if UNKNOWN-BUBBLEWRAP is also negative (will handle below)
        if (row.sku === 'UNKNOWN-BUBBLEWRAP') continue;

        const current = Number(row.current_stock);
        const offset = Math.abs(current);
        if (offset > 0) {
            adjustments.push({
                sku: row.sku,
                loc_id: row.loc_id || 'Unassigned',
                change_qty: offset,
                event_type: 'Audit Adjustment',
                ref_doc: 'AUDIT-RESET-20260904',
                notes: `Audit Baseline Reset: Offset negative balance (${current}) to 0`,
                timestamp: now
            });
        }
    }

    // Process UNKNOWN-BUBBLEWRAP zero-out
    for (const row of ubs) {
        const current = Number(row.current_stock);
        if (current !== 0) {
            const offset = -current;
            adjustments.push({
                sku: row.sku,
                loc_id: row.loc_id || 'Unassigned',
                change_qty: offset,
                event_type: 'Audit Adjustment',
                ref_doc: 'AUDIT-RESET-20260904',
                notes: `Audit Baseline Reset: Zero out UNKNOWN-BUBBLEWRAP (${current}) to 0`,
                timestamp: now
            });
        }
    }

    console.log(`Identified ${adjustments.length} adjustment entries to write to stock_ledger_v2:`);
    console.log(`- Negative stock corrections: ${adjustments.filter(a => a.sku !== 'UNKNOWN-BUBBLEWRAP').length}`);
    console.log(`- UNKNOWN-BUBBLEWRAP zero-out: ${adjustments.filter(a => a.sku === 'UNKNOWN-BUBBLEWRAP').length}\n`);

    if (adjustments.length === 0) {
        console.log('✅ No adjustments needed. All balances are already non-negative and zeroed out.');
        return;
    }

    // Batch insert into stock_ledger_v2
    const BATCH_SIZE = 50;
    let insertedCount = 0;

    for (let i = 0; i < adjustments.length; i += BATCH_SIZE) {
        const batch = adjustments.slice(i, i + BATCH_SIZE);
        const { error: insertErr } = await supabase
            .from('stock_ledger_v2')
            .insert(batch);

        if (insertErr) {
            console.error(`Failed inserting batch ${i / BATCH_SIZE + 1}:`, insertErr);
            process.exit(1);
        }
        insertedCount += batch.length;
        console.log(`  Inserted batch ${i / BATCH_SIZE + 1}: ${insertedCount}/${adjustments.length} rows...`);
    }

    console.log('\n✅ All adjustment entries successfully written to stock_ledger_v2!');

    // Verification
    console.log('\n--- VERIFYING RESULTS ---');
    const { data: verifyNegs } = await supabase
        .from('v2_inventory_view')
        .select('sku, loc_id, current_stock')
        .lt('current_stock', 0);

    const { data: verifyUbs } = await supabase
        .from('v2_inventory_view')
        .select('sku, loc_id, current_stock')
        .eq('sku', 'UNKNOWN-BUBBLEWRAP');

    console.log(`Remaining negative stock rows in v2_inventory_view: ${verifyNegs?.length || 0}`);
    if (verifyNegs && verifyNegs.length > 0) {
        console.table(verifyNegs);
    } else {
        console.log('  🎉 0 negative balances remain in the entire database!');
    }

    console.log(`UNKNOWN-BUBBLEWRAP balances:`);
    console.table(verifyUbs);

    console.log('\n==========================================');
    console.log('🏁 BASELINE AUDIT RESET COMPLETE!');
    console.log('==========================================');
}

applyBaselineReset();
