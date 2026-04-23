import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    console.log("=== Checking stock_ledger_v2 for today ===");
    const today = new Date().toISOString().split('T')[0];
    const { data: ledger } = await supabase.from('stock_ledger_v2')
        .select('sku, type, quantity, source_location, target_location, timestamp')
        .gte('timestamp', today);
        
    console.log("Today's ledger entries:", ledger);
}
main();
