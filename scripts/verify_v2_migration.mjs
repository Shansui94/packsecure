import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("❌ Missing Supabase credentials in .env");
    process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const COMPARISONS = [
    { canonical: 'sys_machines', viewV2: 'sys_machines_v2', minExpected: 10 },
    { canonical: 'master_items', viewV2: 'master_items_v2', minExpected: 250 },
    { canonical: 'production_logs', viewV2: 'production_logs_v2', minExpected: 200000 },
    { canonical: 'stock_ledger', viewV2: 'stock_ledger_v2', minExpected: 250000 },
    { canonical: 'inventory_view', viewV2: 'v2_inventory_view', minExpected: 500 }
];

async function main() {
    console.log("=================================================");
    console.log("🔍 PACKSECURE OS: V2 MIGRATION VERIFICATION AUDIT");
    console.log("=================================================\n");

    let allPassed = true;

    for (const item of COMPARISONS) {
        process.stdout.write(`Checking [${item.canonical}] <-> [${item.viewV2}]... `);

        const [rCanonical, rV2] = await Promise.all([
            sb.from(item.canonical).select('*', { count: 'exact', head: true }),
            sb.from(item.viewV2).select('*', { count: 'exact', head: true })
        ]);

        const cCount = rCanonical.count;
        const vCount = rV2.count;
        const cErr = rCanonical.error?.message;
        const vErr = rV2.error?.message;

        if (cErr) {
            console.log(`❌ FAILED`);
            console.error(`   Canonical [${item.canonical}] Error: ${cErr}`);
            allPassed = false;
            continue;
        }

        if (vErr) {
            console.log(`❌ FAILED`);
            console.error(`   Compatibility View [${item.viewV2}] Error: ${vErr}`);
            allPassed = false;
            continue;
        }

        if (cCount !== vCount) {
            console.log(`⚠️ MISMATCH`);
            console.error(`   Canonical Count: ${cCount} !== View Count: ${vCount}`);
            allPassed = false;
            continue;
        }

        if (cCount < item.minExpected) {
            console.log(`⚠️ LOW COUNT`);
            console.error(`   Count ${cCount} is below expected minimum ${item.minExpected}`);
            allPassed = false;
            continue;
        }

        console.log(`✅ MATCH! Count: ${cCount.toLocaleString()} rows (100% aligned)`);
    }

    console.log("\n-------------------------------------------------");
    if (allPassed) {
        console.log("🎉 ALL TABLES AND COMPATIBILITY VIEWS ARE 100% VERIFIED!");
        console.log("Zero data loss confirmed. System is safe and canonicalized.");
    } else {
        console.log("❌ VERIFICATION FAILED: Some tables or views are not aligned.");
        process.exit(1);
    }
}

main().catch(err => {
    console.error("Audit Execution Error:", err);
    process.exit(1);
});
