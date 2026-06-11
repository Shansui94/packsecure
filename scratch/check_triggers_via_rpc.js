import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
    console.log("Calling query_pg_triggers for sales_orders...");
    const r1 = await s.rpc('query_pg_triggers', { table_name: 'sales_orders' });
    console.log("query_pg_triggers result:", JSON.stringify(r1, null, 2));

    console.log("\nCalling get_table_triggers for sales_orders...");
    const r2 = await s.rpc('get_table_triggers', { target_table: 'sales_orders' });
    console.log("get_table_triggers result:", JSON.stringify(r2, null, 2));

    console.log("\nCalling get_table_triggers for stock_ledger_v2...");
    const r3 = await s.rpc('get_table_triggers', { target_table: 'stock_ledger_v2' });
    console.log("get_table_triggers result for stock_ledger_v2:", JSON.stringify(r3, null, 2));
}

run();
