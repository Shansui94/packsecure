import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    const { data: ledger } = await supabase.from('stock_ledger_v2')
        .select('*')
        .in('ref_doc', ['DO-2026-5358', 'DO-2026-6825', 'DO-2026-3553']);
        
    const grouped = {};
    (ledger || []).forEach(l => {
        if (!grouped[l.ref_doc]) grouped[l.ref_doc] = [];
        grouped[l.ref_doc].push(l);
    });
    
    Object.keys(grouped).forEach(ref => {
        const events = grouped[ref];
        const sum = events.reduce((s, e) => s + e.change_qty, 0);
        console.log(`\n[${ref}] Total Net Change: ${sum}`);
        events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).forEach(e => {
            console.log(`  ${e.timestamp} | ${e.event_type} | ${e.change_qty} | ${e.notes}`);
        });
    });
}
main();
