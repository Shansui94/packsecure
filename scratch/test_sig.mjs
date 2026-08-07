import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test(name, params) {
    try {
        const { data, error } = await supabase.rpc(name, params);
        if (error) {
            console.log(`❌ ${name}(${JSON.stringify(params)}):`, error.message, error.code);
        } else {
            console.log(`✅ ${name}(${JSON.stringify(params)}) succeeded! Result:`, data);
        }
    } catch (err) {
        console.log(`💥 ${name}(${JSON.stringify(params)}) threw:`, err.message);
    }
}

async function run() {
    await test('exec_sql', { query: "SELECT 1;" });
    await test('exec_sql', { sql: "SELECT 1;" });
    await test('exec_sql', { sql_query: "SELECT 1;" });
    await test('run_sql', { query: "SELECT 1;" });
    await test('run_sql', { sql: "SELECT 1;" });
    await test('execute_sql', { sql_query: "SELECT 1;" });
}

run();
