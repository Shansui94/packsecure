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
    console.log("=== CHECKING COLUMNS WITH MACHINE_ID ===");
    
    // We can query the database information_schema to find columns named 'machine_id'
    const query = `
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND column_name = 'machine_id'
        ORDER BY table_name;
    `;
    
    // We don't have execute_sql, but wait!
    // Let's check if we can query this by listing tables or checking if we have any other RPC.
    // Wait, let's see if we can do this through a raw sql execution or look at the typical tables we know:
    // Typical tables in the system:
    const targetTables = [
        'sys_machines_v2', 
        'operator_attendance', 
        'production_logs_v2', 
        'machine_active_products', 
        'stock_ledger_v2', 
        'live_stock',
        'sys_users_v2'
    ];

    for (const table of targetTables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`Table "${table}" failed:`, error.message);
        } else {
            const keys = data.length > 0 ? Object.keys(data[0]) : [];
            if (keys.includes('machine_id')) {
                console.log(`Table "${table}" has column: machine_id`);
            } else {
                console.log(`Table "${table}" does NOT have column: machine_id`);
            }
        }
    }
}

main().catch(console.error);
