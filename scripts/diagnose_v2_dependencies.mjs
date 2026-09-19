import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function runQuery(sql) {
    try {
        const resp = await fetch(`${SUPABASE_URL}/pg/query`, {
            method: 'POST',
            headers: {
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'X-Connection-Encrypted': 'true'
            },
            body: JSON.stringify({ query: sql })
        });
        if (resp.ok) {
            return await resp.json();
        }
        // Fallback to rpc execute_sql or exec_sql
        const r2 = await sb.rpc('exec_sql', { sql_query: sql, query: sql });
        if (!r2.error) return r2.data;
        const r3 = await sb.rpc('execute_sql', { sql_query: sql });
        if (!r3.error) return r3.data;
        return { error: resp.statusText || r2.error?.message || r3.error?.message };
    } catch (err) {
        return { error: err.message };
    }
}

async function main() {
    console.log("=== DIAGNOSING V2 DEPENDENCIES ===");

    // 1. Triggers on V2 tables
    const triggersSql = `
        SELECT 
            event_object_table, 
            trigger_name, 
            event_manipulation, 
            action_statement
        FROM information_schema.triggers 
        WHERE event_object_table IN ('sys_machines_v2', 'master_items_v2', 'production_logs_v2', 'stock_ledger_v2')
        ORDER BY event_object_table, trigger_name;
    `;
    const triggers = await runQuery(triggersSql);
    console.log("Triggers:", JSON.stringify(triggers, null, 2));

    // 2. Views that reference V2 tables
    const viewsSql = `
        SELECT 
            table_name, 
            view_definition 
        FROM information_schema.views 
        WHERE table_schema = 'public' 
          AND (view_definition LIKE '%_v2%' OR table_name LIKE '%v2%');
    `;
    const views = await runQuery(viewsSql);
    console.log("Views:", JSON.stringify(views, null, 2));

    // 3. Foreign key constraints referencing V2 tables
    const fksSql = `
        SELECT
            tc.table_name AS source_table,
            kcu.column_name AS source_column,
            ccu.table_name AS target_table,
            ccu.column_name AS target_column,
            tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND (tc.table_name LIKE '%_v2%' OR ccu.table_name LIKE '%_v2%');
    `;
    const fks = await runQuery(fksSql);
    console.log("Foreign Keys:", JSON.stringify(fks, null, 2));
}

main().catch(console.error);
