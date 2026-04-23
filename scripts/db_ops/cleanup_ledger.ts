import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    const { data: ledger } = await supabase.from('stock_ledger_v2')
        .select('*')
        .eq('event_type', 'Transfer Out')
        .like('notes', 'Auto-deduct%');
        
    const doMap = {};
    (ledger || []).forEach(entry => {
        const ref = entry.ref_doc;
        if (!ref) return;
        if (!doMap[ref]) doMap[ref] = { oldNotes: [], newNotes: [] };
        if (entry.notes === 'Auto-deduct: Order Created') doMap[ref].oldNotes.push(entry);
        else if (entry.notes === 'Auto-deduct: Order Created/Updated') doMap[ref].newNotes.push(entry);
    });

    const doubleDeductedDOs = Object.keys(doMap).filter(ref => doMap[ref].oldNotes.length > 0 && doMap[ref].newNotes.length > 0);
    
    let toDeleteTxnIds = [];
    
    doubleDeductedDOs.forEach(ref => {
        const data = doMap[ref];
        const newEntry = data.newNotes[0];
        
        // We look at the actual insertion time of the 'newNotes' which is the real timestamp
        const timestamp = new Date(newEntry.timestamp).getTime();
        const auditTime = new Date('2026-04-20T12:44:00.000Z').getTime();
        
        if (timestamp > auditTime) {
            // This DO was double-deducted AFTER the audit. We must delete the OLD trigger's entries for it.
            data.oldNotes.forEach(oldE => {
                toDeleteTxnIds.push(oldE.txn_id);
            });
        }
    });
    
    console.log(`Found ${toDeleteTxnIds.length} legacy ledger entries to delete (Post-Audit).`);
    
    if (toDeleteTxnIds.length === 0) {
        console.log("Nothing to delete.");
        return;
    }
    
    // Perform deletion in batches
    const batchSize = 100;
    let deletedCount = 0;
    
    for (let i = 0; i < toDeleteTxnIds.length; i += batchSize) {
        const batch = toDeleteTxnIds.slice(i, i + batchSize);
        const { error } = await supabase.from('stock_ledger_v2')
            .delete()
            .in('txn_id', batch);
            
        if (error) {
            console.error("Error deleting batch:", error);
            break;
        }
        deletedCount += batch.length;
        console.log(`Deleted ${deletedCount} / ${toDeleteTxnIds.length} ...`);
    }
    
    console.log(`Successfully deleted ${deletedCount} duplicate ledger entries!`);
}
main();
