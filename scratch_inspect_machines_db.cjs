const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = './.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function main() {
    console.log("=== INSPECTING SYS_MACHINES_V2 ===");
    const { data: machines, error } = await supabase
        .from('sys_machines_v2')
        .select('*')
        .order('machine_id');

    if (error) {
        console.error("Error fetching machines:", error);
        return;
    }

    console.log(`Found ${machines.length} machines:`);
    console.log(JSON.stringify(machines, null, 2));

    // Let's query distinct factories to understand the factory_id values
    const factories = Array.from(new Set(machines.map(m => m.factory_id)));
    console.log("\nExisting factory IDs in sys_machines_v2:", factories);

    // Let's query the sys_factories or similar table if it exists
    const { data: tables } = await supabase.rpc('get_tables'); // Or just inspect via SQL
    console.log("\nInspecting foreign keys and constraints on sys_machines_v2...");
    
    // Querying PostgreSQL information_schema to find references to sys_machines_v2
    const query = `
        SELECT
            tc.table_name AS referencing_table,
            kcu.column_name AS referencing_column,
            ccu.table_name AS referenced_table,
            ccu.column_name AS referenced_column,
            rc.update_rule AS on_update,
            rc.delete_rule AS on_delete
        FROM
            information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            JOIN information_schema.referential_constraints AS rc
              ON rc.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'sys_machines_v2';
    `;
    
    const { data: fks, error: fkError } = await supabase.rpc('execute_sql', { sql_query: query });
    if (fkError) {
        // Fallback: try raw query if execute_sql doesn't exist, or we can use another RPC
        console.log("execute_sql RPC not available or failed:", fkError.message);
        // Let's try running a direct query or write a fallback
    } else {
        console.log("Foreign keys referencing sys_machines_v2:");
        console.log(JSON.stringify(fks, null, 2));
    }
}

main().catch(console.error);
