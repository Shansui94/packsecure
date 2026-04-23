import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    console.log("=== Checking v2_inventory_view for OPM Lama ===");
    const { data: stock, error } = await supabase.from('v2_inventory_view')
        .select('*')
        .eq('loc_id', 'OPM Lama');
        
    console.log("Error:", error);
    
    let totalStock = 0;
    (stock || []).forEach(item => {
        totalStock += item.quantity;
        console.log(`${item.sku}: ${item.quantity}`);
    });
    console.log("Total Stock in OPM Lama:", totalStock);
    
    console.log("\n=== Checking today's production from stock_ledger_v2 ===");
    const today = new Date().toISOString().split('T')[0];
    const { data: ledger } = await supabase.from('stock_ledger_v2')
        .select('sku, change_qty')
        .gte('timestamp', today)
        .ilike('event_type', '%Production%')
        .eq('loc_id', 'OPM Lama');
        
    let todayOutput = 0;
    (ledger || []).forEach(entry => todayOutput += entry.change_qty);
    console.log("Today's Output to OPM Lama:", todayOutput);
}
main();
