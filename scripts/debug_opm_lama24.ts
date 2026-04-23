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
    
    console.log("Double Deductions after April 20th 12:44:00:");
    
    let totalQtyToRestore = 0;
    
    doubleDeductedDOs.forEach(ref => {
        const data = doMap[ref];
        const oldEntry = data.oldNotes[0];
        const newEntry = data.newNotes[0];
        
        // We look at the actual insertion time of the 'newNotes' which is the real timestamp
        const timestamp = new Date(newEntry.timestamp).getTime();
        const auditTime = new Date('2026-04-20T12:44:00.000Z').getTime();
        
        if (timestamp > auditTime) {
            console.log(`[${ref}] Timestamp: ${newEntry.timestamp}`);
            console.log(`  -> Old Trigger Entries: ${data.oldNotes.length} (Qty: ${data.oldNotes.reduce((sum, e) => sum + e.change_qty, 0)})`);
            totalQtyToRestore += data.oldNotes.reduce((sum, e) => sum + e.change_qty, 0);
        }
    });
    
    console.log(`\nTotal Stock to restore (Post-Audit): ${totalQtyToRestore}`);
}
main();
