import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const query = `
        SELECT t.tgname 
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE c.relname = 'sales_orders' AND NOT t.tgisinternal;
    `;
    const { data, error } = await supabase.rpc('execute_sql', { query });
    if (error) {
        console.error("RPC Error:", error);
    } else {
        console.log("Triggers on sales_orders:", data);
    }
}
main();
