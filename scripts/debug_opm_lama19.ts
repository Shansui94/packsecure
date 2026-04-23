import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    const { data: ledger } = await supabase.from('stock_ledger_v2')
        .select('*')
        .eq('ref_doc', 'DO-2026-9775');
        
    console.log("Double deductions for DO-2026-9775:");
    let firstSet = (ledger || []).filter(l => l.notes === 'Auto-deduct: Order Created/Updated');
    let secondSet = (ledger || []).filter(l => l.notes === 'Auto-deduct: Order Created');
    
    console.log(`First set (Order Created/Updated): ${firstSet.length} entries`);
    console.log(`Second set (Order Created): ${secondSet.length} entries`);
    
    if (firstSet.length > 0) console.log("Example first:", firstSet[0]);
    if (secondSet.length > 0) console.log("Example second:", secondSet[0]);
    
    const { data: order } = await supabase.from('sales_orders').select('*').eq('id', 'DO-2026-9775').single();
    console.log("\nSales Order DO-2026-9775:", JSON.stringify(order, null, 2));
}
main();
