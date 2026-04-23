import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    console.log("=== Checking locations ===");
    const { data: locations } = await supabase.from('sys_locations').select('*');
    console.log(locations);

    console.log("\n=== Checking today's production logs ===");
    const today = new Date().toISOString().split('T')[0];
    const { data: logs } = await supabase.from('production_logs_v2')
        .select('sku, machine_id, output_qty')
        .gte('created_at', today);
        
    const summary = {};
    (logs || []).forEach(log => {
        if (!summary[log.sku]) summary[log.sku] = 0;
        summary[log.sku] += (log.output_qty || 0);
    });
    console.log("Today's Output by SKU:", summary);
    
    console.log("\n=== Checking today's stock ledger ===");
    const { data: ledger } = await supabase.from('stock_ledger_v2')
        .select('sku, type, quantity, source_location, target_location')
        .gte('created_at', today)
        .eq('type', 'PRODUCTION');
        
    const ledgerSummary = {};
    (ledger || []).forEach(entry => {
        if (!ledgerSummary[entry.sku]) ledgerSummary[entry.sku] = 0;
        ledgerSummary[entry.sku] += entry.quantity;
    });
    console.log("Today's Ledger Production by SKU:", ledgerSummary);
}
main();
