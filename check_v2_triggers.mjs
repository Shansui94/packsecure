import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function checkTriggersV2() {
    console.log("Checking triggers on production_logs_v2 in Information Schema...");
    const { data } = await s.rpc('execute_sql', {
        sql_query: "SELECT trigger_name, event_manipulation, event_object_table, action_statement FROM information_schema.triggers WHERE event_object_table = 'production_logs_v2'"
    }).catch(err => {
        return { data: 'RPC failed: ' + err.message };
    });

    console.log(JSON.stringify(data, null, 2));
}

checkTriggersV2();
