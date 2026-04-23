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
    
    console.log(`Still double deducted: ${doubleDeductedDOs.length}`);
    doubleDeductedDOs.forEach(ref => {
        console.log(`[${ref}] Old: ${doMap[ref].oldNotes.length}, New: ${doMap[ref].newNotes.length}`);
        console.log(`  New timestamp: ${doMap[ref].newNotes[0].timestamp}`);
    });
}
main();
