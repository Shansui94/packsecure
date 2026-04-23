import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    console.log("=== Checking stock_ledger_v2 for today ===");
    const today = new Date().toISOString().split('T')[0];
    const { data: ledger, error } = await supabase.from('stock_ledger_v2')
        .select('sku, type, quantity, source_location, target_location')
        .gte('timestamp', today)
        .eq('type', 'PRODUCTION');
        
    const ledgerSummary = {};
    (ledger || []).forEach(entry => {
        if (!ledgerSummary[entry.sku]) ledgerSummary[entry.sku] = 0;
        ledgerSummary[entry.sku] += entry.quantity;
    });
    console.log("Today's Ledger Production by SKU:", ledgerSummary);
    
    // Let's also check OPM Lama location ID
    const { data: locations } = await supabase.from('locations').select('*');
    console.log("Locations:", locations);
}
main();
