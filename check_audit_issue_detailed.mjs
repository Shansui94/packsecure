import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    let output = "";
    const log = (msg) => {
        output += msg + "\n";
    };

    log("=== STEP 1: All Audits Posted Today (2026-06-10) ===");
    const { data: audits, error: auditErr } = await s.from('stock_ledger_v2')
        .select('*')
        .eq('event_type', 'Audit Adjustment')
        .gte('timestamp', '2026-06-10T00:00:00.000Z')
        .order('timestamp', { ascending: false });

    if (auditErr) {
        log("Error fetching audits: " + JSON.stringify(auditErr));
        fs.writeFileSync('audit_analysis_output.txt', output);
        return;
    }

    log(`Found ${audits.length} audit adjustments today.`);
    
    // Group audits by location and SKU
    const auditMap = new Map();
    audits.forEach(row => {
        const key = `${row.loc_id}|${row.sku}`;
        if (!auditMap.has(key)) {
            auditMap.set(key, []);
        }
        auditMap.get(key).push(row);
    });

    for (const [key, list] of auditMap.entries()) {
        const [loc, sku] = key.split('|');
        log(`\nLocation: [${loc}], SKU: [${sku}]`);
        list.forEach(a => {
            log(`  - Audit at ${a.timestamp} (Change Qty: ${a.change_qty})`);
            log(`    Ref Doc: ${a.ref_doc}`);
            log(`    Notes: ${a.notes}`);
            log(`    Created by: ${a.created_by_name || a.created_by}`);
        });

        // Let's query transactions for this SKU at this location that occurred AFTER the earliest audit today
        const earliestAuditTime = list[list.length - 1].timestamp;
        const { data: postTxns, error: postTxnsErr } = await s.from('stock_ledger_v2')
            .select('*')
            .eq('loc_id', loc)
            .eq('sku', sku)
            .gt('timestamp', earliestAuditTime)
            .order('timestamp', { ascending: true });

        if (postTxnsErr) {
            log(`    Error fetching post-audit transactions: ${JSON.stringify(postTxnsErr)}`);
        } else if (postTxns.length > 0) {
            log(`    --> ${postTxns.length} transactions occurred AFTER this audit:`);
            postTxns.forEach(t => {
                log(`      * ${t.timestamp}: [${t.event_type}] Change: ${t.change_qty}, Notes: "${t.notes}"`);
            });
        } else {
            log(`    --> No transactions occurred after this audit.`);
        }
    }

    log("\n=== STEP 2: Checking Negative Live Stock in v2_inventory_view ===");
    const { data: negStock, error: negErr } = await s.from('v2_inventory_view')
        .select('*')
        .lt('current_stock', 0);

    if (negErr) {
        log("Error fetching negative stock: " + JSON.stringify(negErr));
    } else {
        log(`Found ${negStock.length} items with negative stock in view:`);
        for (const row of negStock) {
            log(`- [${row.loc_id}] SKU: ${row.sku}, stock: ${row.current_stock}, last_updated: ${row.last_updated}`);
            
            // Check if this negative SKU/Location had any audits today
            const key = `${row.loc_id}|${row.sku}`;
            if (auditMap.has(key)) {
                log(`  --> NOTE: This item WAS audited today at this location!`);
            } else {
                log(`  --> NOTE: This item was NOT audited today at this location.`);
            }
        }
    }

    fs.writeFileSync('audit_analysis_output.txt', output);
    console.log("Analysis written to audit_analysis_output.txt");
}

run();
