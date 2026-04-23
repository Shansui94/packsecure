import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    // 1. Fetch Orders from 19th to 21st
    const { data: orders } = await supabase.from('sales_orders')
        .select('order_number, factory_id, items, created_at')
        .gte('created_at', '2026-04-19T00:00:00Z')
        .lte('created_at', '2026-04-21T23:59:59Z');
        
    // Find mismatches in Orders
    const mismatchedItems = [];
    orders?.forEach(o => {
        if (!o.items) return;
        o.items.forEach(item => {
            const loc = (item.sourceLocation || '').trim();
            if (loc && loc !== o.factory_id) {
                mismatchedItems.push({
                    order_number: o.order_number,
                    orderFactory: o.factory_id,
                    trueLocation: loc,
                    sku: item.sku.trim(),
                    qty: Number(item.quantity)
                });
            }
        });
    });

    console.log(`Found ${mismatchedItems.length} mismatched items in orders.`);

    // 2. Fetch corresponding Ledger Entries
    const orderNumbers = Array.from(new Set(mismatchedItems.map(m => m.order_number)));
    const { data: ledger } = await supabase.from('stock_ledger_v2')
        .select('*')
        .in('ref_doc', orderNumbers)
        .eq('event_type', 'Transfer Out') // Only care about deductions
        .like('notes', 'Auto-deduct%');
        
    // 3. Fetch all Audits
    const { data: audits } = await supabase.from('stock_ledger_v2')
        .select('*')
        .in('event_type', ['Audit', 'Audit Adjustment']);
        
    const entriesToMove = [];
    
    // Map items to ledger entries
    mismatchedItems.forEach(m => {
        // Find the ledger entry that deducted from the WRONG factory (orderFactory)
        const lEntry = ledger?.find(l => 
            l.ref_doc === m.order_number && 
            l.sku === m.sku && 
            l.loc_id === m.orderFactory &&
            Math.abs(l.change_qty) === m.qty
        );
        
        if (lEntry) {
            entriesToMove.push({
                ledgerTxnId: lEntry.txn_id,
                sku: lEntry.sku,
                wrongLoc: lEntry.loc_id,
                trueLoc: m.trueLocation,
                changeQty: lEntry.change_qty, // e.g. -82
                timestamp: lEntry.timestamp,
                refDoc: lEntry.ref_doc
            });
        }
    });

    console.log(`Found ${entriesToMove.length} concrete ledger entries to move.`);

    // 4. Calculate Audit Compensations
    const auditUpdates = {};
    
    entriesToMove.forEach(move => {
        // Find the FIRST audit for this SKU in the WRONG location AFTER the transaction
        const nextWrongLocAudit = audits?.find(a => 
            a.sku === move.sku && 
            a.loc_id === move.wrongLoc && 
            new Date(a.timestamp).getTime() > new Date(move.timestamp).getTime()
        );
        
        if (nextWrongLocAudit) {
            const id = nextWrongLocAudit.txn_id;
            if (!auditUpdates[id]) {
                auditUpdates[id] = {
                    txnId: id,
                    sku: move.sku,
                    loc: move.wrongLoc,
                    originalQty: nextWrongLocAudit.change_qty,
                    netAdjustment: 0
                };
            }
            // Moving away a negative value (-82) increases the base stock by 82.
            // To compensate, the audit must DECREASE by 82.
            // Since move.changeQty is -82, adding it decreases the audit by 82.
            auditUpdates[id].netAdjustment += move.changeQty;
        }

        // What about the trueLoc? Did it have an audit AFTER?
        const nextTrueLocAudit = audits?.find(a => 
            a.sku === move.sku && 
            a.loc_id === move.trueLoc && 
            new Date(a.timestamp).getTime() > new Date(move.timestamp).getTime()
        );
        
        if (nextTrueLocAudit) {
            const id = nextTrueLocAudit.txn_id;
            if (!auditUpdates[id]) {
                auditUpdates[id] = {
                    txnId: id,
                    sku: move.sku,
                    loc: move.trueLoc,
                    originalQty: nextTrueLocAudit.change_qty,
                    netAdjustment: 0
                };
            }
            // Moving a negative value (-82) TO trueLoc decreases trueLoc base stock by 82.
            // To compensate, the audit must INCREASE by 82.
            // Subtracting (-82) adds 82.
            auditUpdates[id].netAdjustment -= move.changeQty;
        }
    });

    console.log(`\nAudit Adjustments Needed: ${Object.keys(auditUpdates).length}`);
    Object.values(auditUpdates).forEach((a: any) => {
        console.log(`  [${a.loc}] SKU: ${a.sku} | Old: ${a.originalQty} -> New: ${a.originalQty + a.netAdjustment}`);
    });
    
    console.log(`\nReady to execute. Uncomment execute code to run.`);
    // 5. Execute Updates
    console.log("Updating ledger entries loc_id...");
    for (const move of entriesToMove) {
        await supabase.from('stock_ledger_v2')
            .update({ loc_id: move.trueLoc })
            .eq('txn_id', move.ledgerTxnId);
    }
    
    console.log("Updating audit compensations...");
    for (const auditId of Object.keys(auditUpdates)) {
        const update = auditUpdates[auditId];
        await supabase.from('stock_ledger_v2')
            .update({ change_qty: update.originalQty + update.netAdjustment })
            .eq('txn_id', auditId);
    }
    console.log("Done!");
}
main();
