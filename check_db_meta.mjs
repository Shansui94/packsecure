import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    // 1. Get View Definition
    console.log("--- VIEW DEF ---");
    const { data: q1, error: e1 } = await s.rpc('execute_sql', {
        sql_query: "SELECT pg_get_viewdef('v2_inventory_view', true) AS view_def;"
    });
    console.log(e1 || q1);

    // 2. Get Triggers
    console.log("--- TRIGGERS ---");
    const { data: q2, error: e2 } = await s.rpc('execute_sql', {
        sql_query: "SELECT trigger_name, event_manipulation, event_object_table, action_statement FROM information_schema.triggers WHERE event_object_table IN ('production_logs', 'production_logs_v2')"
    });
    console.log(e2 || q2);
}

check();
