import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    console.log("--- SALES ORDER TRIGGERS ---");
    const { data: q1, error: e1 } = await s.rpc('execute_sql', {
        sql_query: "SELECT trigger_name, event_manipulation, event_object_table, action_statement FROM information_schema.triggers WHERE event_object_table = 'sales_orders'"
    });
    if (e1) {
        console.error("Error fetching triggers:", e1);
    } else {
        console.log("Triggers:", JSON.stringify(q1, null, 2));
    }

    console.log("--- GET SYNC_ORDER_INVENTORY FUNCTION DEFINITION ---");
    const { data: q2, error: e2 } = await s.rpc('execute_sql', {
        sql_query: "SELECT prosrc FROM pg_proc WHERE proname = 'sync_order_inventory'"
    });
    if (e2) {
        console.error("Error fetching function:", e2);
    } else {
        console.log("Function Definition:", JSON.stringify(q2, null, 2));
    }
}

check();
