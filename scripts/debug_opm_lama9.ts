import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    console.log("=== Checking stock_ledger_v2 for today ===");
    const today = new Date().toISOString().split('T')[0];
    const { data: ledger, error } = await supabase.from('stock_ledger_v2')
        .select('*')
        .gte('timestamp', today)
        .ilike('event_type', '%Production%');
        
    console.log("Error:", error);
    
    let totalOutput = 0;
    const ledgerSummary = {};
    (ledger || []).forEach(entry => {
        if (!ledgerSummary[entry.sku]) ledgerSummary[entry.sku] = 0;
        ledgerSummary[entry.sku] += entry.change_qty;
        totalOutput += entry.change_qty;
    });
    console.log("Today's Ledger Production by SKU:", ledgerSummary);
    console.log("Total output in ledger:", totalOutput);
}
main();
