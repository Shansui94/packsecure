import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
    console.log("Checking triggers on sales_orders...");
    const query = `
        SELECT 
            tgname as trigger_name,
            tgenabled as enabled,
            pg_get_triggerdef(oid) as trigger_definition
        FROM pg_trigger 
        WHERE tgrelid = 'public.sales_orders'::regclass;
    `;
    let res = await s.rpc('exec_sql', { query: query });
    if (res.error) {
        res = await s.rpc('exec_sql', { sql_query: query });
    }
    const { data, error } = res;
    if (error) {
        console.error("Error executing query:", error);
    } else {
        console.log("Triggers:", JSON.stringify(data, null, 2));
    }

    console.log("\nChecking definitions of sync_order_inventory...");
    const funcQuery = `
        SELECT 
            proname,
            pg_get_functiondef(oid) as definition
        FROM pg_proc 
        WHERE proname = 'sync_order_inventory';
    `;
    let resFunc = await s.rpc('exec_sql', { query: funcQuery });
    if (resFunc.error) {
        resFunc = await s.rpc('exec_sql', { sql_query: funcQuery });
    }
    const { data: funcData, error: funcError } = resFunc;
    if (funcError) {
        console.error("Error fetching function:", funcError);
    } else {
        console.log("Function Definition:", funcData?.[0]?.definition || "Not found");
    }
}

run();
