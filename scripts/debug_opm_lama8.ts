import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    const { data: ledger, error } = await supabase.from('stock_ledger_v2')
        .select('*')
        .limit(1);
    console.log("Error:", error);
    console.log("Schema from first row:", ledger?.[0]);
}
main();
