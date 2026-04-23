import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    const today = new Date().toISOString().split('T')[0];
    const { data: ledger } = await supabase.from('stock_ledger_v2')
        .select('*')
        .gte('timestamp', today);
        
    console.log(`Total ledger entries today: ${ledger?.length}`);
    
    let types = {};
    let locs = {};
    (ledger || []).forEach(l => {
        types[l.event_type] = (types[l.event_type] || 0) + 1;
        locs[l.loc_id] = (locs[l.loc_id] || 0) + 1;
        if (l.event_type === 'Transfer Out' || l.event_type === 'Delivered') {
            console.log(`Deduction: ${l.change_qty} from ${l.loc_id} (Ref: ${l.ref_doc})`);
        }
    });
    
    console.log("Types:", types);
    console.log("Locs:", locs);
}
main();
