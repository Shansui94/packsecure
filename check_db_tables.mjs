import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const { data, error } = await s.rpc('execute_sql', {
        sql_query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
    });
    if (error) {
        console.error("RPC Error:", error);
    } else {
        console.log("Tables in public schema:");
        data.forEach(row => console.log(`- ${row.table_name}`));
    }
}

run();
