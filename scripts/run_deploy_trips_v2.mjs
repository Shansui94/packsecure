import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch'; // If node-fetch is not available, we can use global fetch in Node 18+

const envContent = readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0 && !line.startsWith('#')) {
        env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
}
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const sql = readFileSync('supabase/migrations/deploy_trips_v2.sql', 'utf8');

async function run() {
    console.log('Attempting to run deploy_trips_v2.sql in Supabase...');

    // 1. Try 'exec_sql' RPC
    console.log('1. Trying RPC "exec_sql"...');
    const { data: d1, error: e1 } = await supabase.rpc('exec_sql', { query: sql });
    if (!e1) {
        console.log('✅ Tables created successfully via RPC exec_sql!');
        return;
    }
    console.log('RPC exec_sql failed:', e1.message);

    // 2. Try 'execute_sql' RPC
    console.log('2. Trying RPC "execute_sql"...');
    const { data: d2, error: e2 } = await supabase.rpc('execute_sql', { sql_query: sql });
    if (!e2) {
        console.log('✅ Tables created successfully via RPC execute_sql!');
        return;
    }
    console.log('RPC execute_sql failed:', e2.message);

    // 3. Try '/pg/query' endpoint
    console.log('3. Trying direct "/pg/query" endpoint...');
    try {
        const sqlResp = await globalThis.fetch(`${SUPABASE_URL}/pg/query`, {
            method: 'POST',
            headers: {
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: sql })
        });

        if (sqlResp.ok) {
            console.log('✅ Tables created successfully via /pg/query!');
            return;
        }
        const errText = await sqlResp.text();
        console.log(`/pg/query failed (${sqlResp.status}):`, errText.substring(0, 300));
    } catch (err) {
        console.log('/pg/query exception:', err.message);
    }

    console.log('\n⚠️ Automated SQL execution failed. Please copy the SQL from "supabase/migrations/deploy_trips_v2.sql" and run it manually in the Supabase Dashboard SQL Editor.');
}

run();
