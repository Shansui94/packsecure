import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    const { data: audits, error } = await supabase.from('stock_ledger_v2')
        .select('*')
        .in('event_type', ['Audit', 'Adjustment', 'Stock Take', 'Manual Adjustment', 'Audit Adjustment']);
        
    console.log(`Total Audit entries found: ${audits?.length || 0}`);
    
    if (audits && audits.length > 0) {
        // Sort by timestamp
        audits.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        console.log("Recent 10 Audits:");
        audits.slice(0, 10).forEach(a => {
            console.log(`[${a.timestamp}] ${a.loc_id} | ${a.sku} | Qty: ${a.change_qty} | Event: ${a.event_type} | Notes: ${a.notes} | Ref: ${a.ref_doc}`);
        });
    }
}
main();
