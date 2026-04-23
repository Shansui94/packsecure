import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    const today = new Date().toISOString().split('T')[0];
    const { data: ledger, error } = await supabase.from('stock_ledger_v2')
        .select('loc_id, change_qty')
        .gte('timestamp', today)
        .ilike('event_type', '%Production%');
        
    const locSummary = {};
    (ledger || []).forEach(entry => {
        if (!locSummary[entry.loc_id]) locSummary[entry.loc_id] = 0;
        locSummary[entry.loc_id] += entry.change_qty;
    });
    console.log("Today's Production by Location:", locSummary);
}
main();
