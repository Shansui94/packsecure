import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    // 1. Fetch all Transfer Out ledger entries with notes containing 'Auto-deduct'
    const { data: ledger, error } = await supabase.from('stock_ledger_v2')
        .select('*')
        .eq('event_type', 'Transfer Out')
        .like('notes', 'Auto-deduct%');
        
    if (error) {
        console.error("Error fetching ledger:", error);
        return;
    }

    console.log(`Total auto-deduct entries found: ${ledger.length}`);

    // 2. Group by ref_doc (DO number)
    const doMap = {};
    ledger.forEach(entry => {
        const ref = entry.ref_doc;
        if (!ref) return;
        if (!doMap[ref]) {
            doMap[ref] = {
                oldNotes: [], // 'Auto-deduct: Order Created'
                newNotes: [], // 'Auto-deduct: Order Created/Updated'
                totalQtyOld: 0,
                totalQtyNew: 0
            };
        }
        
        if (entry.notes === 'Auto-deduct: Order Created') {
            doMap[ref].oldNotes.push(entry);
            doMap[ref].totalQtyOld += entry.change_qty;
        } else if (entry.notes === 'Auto-deduct: Order Created/Updated') {
            doMap[ref].newNotes.push(entry);
            doMap[ref].totalQtyNew += entry.change_qty;
        }
    });

    // 3. Find DOs that have BOTH old and new notes (Double Deduction)
    const doubleDeductedDOs = Object.keys(doMap).filter(ref => doMap[ref].oldNotes.length > 0 && doMap[ref].newNotes.length > 0);
    
    let totalStockDoubleDeducted = 0;
    
    console.log(`\nFound ${doubleDeductedDOs.length} Delivery Orders with DOUBLE DEDUCTIONS:\n`);
    
    doubleDeductedDOs.forEach(ref => {
        const data = doMap[ref];
        console.log(`[${ref}]`);
        console.log(`  -> Old Trigger Entries: ${data.oldNotes.length} (Qty: ${data.totalQtyOld})`);
        console.log(`  -> New Trigger Entries: ${data.newNotes.length} (Qty: ${data.totalQtyNew})`);
        totalStockDoubleDeducted += data.totalQtyOld; // The old one is usually the duplicate we want to delete
    });
    
    console.log(`\n======================================================`);
    console.log(`TOTAL STOCK INCORRECTLY DEDUCTED: ${totalStockDoubleDeducted} units (from old trigger)`);
    console.log(`======================================================\n`);
    
    // Check if there are any that have ONLY old or ONLY new.
    const onlyOld = Object.keys(doMap).filter(ref => doMap[ref].oldNotes.length > 0 && doMap[ref].newNotes.length === 0);
    const onlyNew = Object.keys(doMap).filter(ref => doMap[ref].oldNotes.length === 0 && doMap[ref].newNotes.length > 0);
    
    console.log(`DOs with ONLY Old Trigger: ${onlyOld.length}`);
    console.log(`DOs with ONLY New Trigger: ${onlyNew.length}`);
}
main();
