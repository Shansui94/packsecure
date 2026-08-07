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
    console.log("=== Analyzing Audit AUDIT-20260624 Discrepancies ===");

    // 1. Fetch all audit records for OPM Lama
    const { data: auditRecords, error: err1 } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('ref_doc', 'AUDIT-20260624')
        .eq('loc_id', 'OPM Lama');

    if (err1) {
        console.error(err1);
        return;
    }

    console.log(`Found ${auditRecords.length} audit records.`);

    // 2. For each SKU, calculate the running stock before the audit timestamp
    for (const r of auditRecords) {
        // We want to sum change_qty for this SKU at OPM Lama before this transaction timestamp
        // Excluding this transaction itself!
        const { data: previousTxns, error: err2 } = await supabase
            .from('stock_ledger_v2')
            .select('change_qty')
            .eq('sku', r.sku)
            .eq('loc_id', 'OPM Lama')
            .lt('timestamp', r.timestamp);

        if (err2) {
            console.error(`Error fetching previous txns for ${r.sku}:`, err2);
            continue;
        }

        let systemStockBefore = 0;
        previousTxns.forEach(t => systemStockBefore += Number(t.change_qty));

        // The audit record change_qty is r.change_qty, which was based on System = 0 (so it equals the actual count)
        const actualCount = Number(r.change_qty); 
        const correctChangeQty = actualCount - systemStockBefore;
        const currentSumWithWrongAdjustment = systemStockBefore + actualCount; // what it is now in OPM Lama

        console.log(`SKU: ${r.sku}`);
        console.log(`  - System Stock before audit at OPM Lama: ${systemStockBefore}`);
        console.log(`  - Baby's Actual Count: ${actualCount}`);
        console.log(`  - Wrong Adjustment (since system was 0 at SPD): +${actualCount}`);
        console.log(`  - Correct Adjustment should be: ${correctChangeQty >= 0 ? '+' : ''}${correctChangeQty}`);
        console.log(`  - Current stock level now (with wrong adjustment): ${currentSumWithWrongAdjustment}`);
        console.log(`  - Correct stock level should be (Actual Count): ${actualCount}`);
    }
}

main().catch(console.error);
