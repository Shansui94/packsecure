import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const { data, error } = await s.rpc('get_policies_for_table', { table_name: 'sys_users_v2' });
    if (error) {
        // Fallback: query pg_policies directly
        const { data: policies, error: pgError } = await s.rpc('execute_sql', {
            sql_query: "SELECT * FROM pg_policies WHERE tablename = 'sys_users_v2'"
        });
        console.log("pg_policies result:", policies || pgError);
    } else {
        console.log("get_policies_for_table result:", data);
    }
}

// Helper sql runner if execute_sql or custom rpc is not available
async function runWithDirectSql() {
    // Let's write a script that queries the database using direct SQL or check postgres policies
    const { data, error } = await s.from('sys_users_v2').select('count');
    console.log("Direct sys_users_v2 count query:", data || error);
}

runDirectQuery();

async function runDirectQuery() {
    // Let's fetch the actual postgres policies using a simple query if execute_sql is not defined, 
    // or we can run a SQL command using node-postgres since we have PG credentials from the Compaction Summary!
    // PG Credentials:
    // Host: aws-1-ap-south-1.pooler.supabase.com
    // Port: 6543
    // User: postgres.kdahubyhwndgyloaljak
    // DB: postgres
    // Password: $QNQ4rAW*#%294z
    
    // Let's import pg
    try {
        const pg = await import('pg');
        const client = new pg.default.Client({
            connectionString: "postgresql://postgres.kdahubyhwndgyloaljak:$QNQ4rAW*%23%294z@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
        });
        await client.connect();
        const res = await client.query("SELECT * FROM pg_policies WHERE tablename = 'sys_users_v2'");
        console.log("Policies on sys_users_v2:");
        console.log(res.rows);
        await client.end();
    } catch (err) {
        console.error("PG Query error:", err);
    }
}
