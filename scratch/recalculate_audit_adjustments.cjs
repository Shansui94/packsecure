const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = 'c:/Users/Max Tan/Downloads/Packsecure OS/packsecure/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function main() {
    console.log("=== Recalculating Audit Adjustments for AUDIT-20260624 ===");

    // 1. Fetch all audit records for OPM Lama
    const { data: auditRecords, error: err1 } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('ref_doc', 'AUDIT-20260624')
        .eq('loc_id', 'OPM Lama');

    if (err1) {
        console.error("Fetch error:", err1);
        return;
    }

    let successCount = 0;
    for (const r of auditRecords) {
        // Query previous transactions sum before this timestamp
        const { data: previousTxns, error: err2 } = await supabase
            .from('stock_ledger_v2')
            .select('change_qty')
            .eq('sku', r.sku)
            .eq('loc_id', 'OPM Lama')
            .lt('timestamp', r.timestamp);

        if (err2) {
            console.error(`Error querying previous for ${r.sku}:`, err2);
            continue;
        }

        let systemStockBefore = 0;
        previousTxns.forEach(t => systemStockBefore += Number(t.change_qty));

        // In the original SPD audit, change_qty equals Baby's Actual Count
        const actualCount = Number(r.notes.match(/Actual:\s*(-?\d+)/)[1]); 
        const correctChangeQty = actualCount - systemStockBefore;

        const newNotes = `Auto-adjusted from Audit at [OPM Lama]. System: ${systemStockBefore}, Actual: ${actualCount}`;

        console.log(`Updating ${r.sku}: change_qty = ${correctChangeQty}, notes = "${newNotes}"`);

        const { error: updateErr } = await supabase
            .from('stock_ledger_v2')
            .update({
                change_qty: correctChangeQty,
                notes: newNotes
            })
            .eq('txn_id', r.txn_id);

        if (updateErr) {
            console.error(`Update failed for ${r.sku}:`, updateErr.message);
        } else {
            successCount++;
        }
    }

    console.log(`\nSuccessfully updated ${successCount} out of ${auditRecords.length} audit records in stock_ledger_v2.`);
}

main().catch(console.error);
