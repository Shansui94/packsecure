import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("=== Querying Active RLS Policies ===");
    const { data, error } = await s.rpc('execute_sql', {
        sql_query: `
            SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check 
            FROM pg_policies 
            WHERE schemaname = 'public' 
              AND tablename IN ('sys_users_v2', 'payroll_records', 'salary_advances', 'employee_leave')
            ORDER BY tablename, policyname;
        `
    });
    if (error) {
        console.error("RPC Error:", error);
    } else {
        data.forEach(row => {
            console.log(`Table: ${row.tablename}`);
            console.log(`  Policy: ${row.policyname}`);
            console.log(`  Cmd: ${row.cmd}`);
            console.log(`  Roles: ${row.roles}`);
            console.log(`  Qual: ${row.qual}`);
            console.log(`  With Check: ${row.with_check}`);
            console.log('-------------------------------');
        });
    }
}

run();
