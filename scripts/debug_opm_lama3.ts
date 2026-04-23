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
        .gte('created_at', today);
    console.log("Error:", error);
    console.log("Ledger length:", ledger?.length);
    
    // Check if there are ANY entries in stock_ledger_v2
    const { count } = await supabase.from('stock_ledger_v2').select('*', { count: 'exact', head: true });
    console.log("Total ledger rows:", count);
}
main();
