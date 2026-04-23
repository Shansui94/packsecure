import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    const { data: ledger } = await supabase.from('stock_ledger_v2')
        .select('*')
        .order('timestamp', { ascending: true });
        
    const doMap = {};
    (ledger || []).forEach(entry => {
        if (entry.event_type === 'Transfer Out' && entry.notes && entry.notes.startsWith('Auto-deduct')) {
            const ref = entry.ref_doc;
            if (!ref) return;
            if (!doMap[ref]) doMap[ref] = { oldNotes: [], newNotes: [] };
            if (entry.notes === 'Auto-deduct: Order Created') doMap[ref].oldNotes.push(entry);
            else if (entry.notes === 'Auto-deduct: Order Created/Updated') doMap[ref].newNotes.push(entry);
        }
    });

    const doubleDeductedDOs = Object.keys(doMap).filter(ref => doMap[ref].oldNotes.length > 0 && doMap[ref].newNotes.length > 0);
    
    // Find all audits
    const audits = (ledger || []).filter(l => l.event_type === 'Audit Adjustment' || l.event_type === 'Audit');
    
    let corrections = [];
    
    doubleDeductedDOs.forEach(ref => {
        const data = doMap[ref];
        const newEntry = data.newNotes[0];
        const timestamp = new Date(newEntry.timestamp).getTime();
        const auditTime = new Date('2026-04-20T12:44:00.000Z').getTime();
        
        if (timestamp <= auditTime) {
            // These are the pre-audit double deductions.
            data.oldNotes.forEach(oldE => {
                // Find the NEXT audit for this exact SKU and Location after this old entry
                const nextAudit = audits.find(a => 
                    a.sku === oldE.sku && 
                    a.loc_id === oldE.loc_id && 
                    new Date(a.timestamp).getTime() > new Date(oldE.timestamp).getTime()
                );
                
                if (nextAudit) {
                    corrections.push({
                        deleteTxnId: oldE.txn_id,
                        qtyToRestore: Math.abs(oldE.change_qty), // The old entry was negative
                        auditTxnId: nextAudit.txn_id,
                        auditCurrentQty: nextAudit.change_qty,
                        sku: oldE.sku
                    });
                } else {
                    console.log(`WARNING: No subsequent audit found for ${oldE.sku} in ${oldE.loc_id} after DO ${ref}`);
                }
            });
        }
    });
    
    console.log(`Found ${corrections.length} pre-audit duplicate entries to clean up.`);
    if (corrections.length > 0) {
        console.log("Sample correction:");
        console.log(corrections[0]);
    }
    
    // Aggregate audit adjustments
    const auditAdjustments = {};
    corrections.forEach(c => {
        if (!auditAdjustments[c.auditTxnId]) {
            auditAdjustments[c.auditTxnId] = {
                currentQty: c.auditCurrentQty,
                adjustBy: 0,
                sku: c.sku
            };
        }
        // If we DELETE a negative entry (-82), stock goes UP by 82.
        // Therefore, the Audit Adjustment must go DOWN by 82 to compensate.
        auditAdjustments[c.auditTxnId].adjustBy -= c.qtyToRestore;
    });
    
    console.log("\nAudits to update:");
    Object.keys(auditAdjustments).forEach(auditId => {
        const a = auditAdjustments[auditId];
        console.log(`Audit [${auditId}] (SKU: ${a.sku}): Current ${a.currentQty} -> New ${a.currentQty + a.adjustBy}`);
    });
}
main();
