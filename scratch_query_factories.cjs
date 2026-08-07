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
    console.log("=== INSPECTING SYS_FACTORIES OR SIMILAR ===");
    
    // Let's query public schema tables using standard postgres catalog query
    const catalogQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    `;
    
    // We can run catalog query by calling an RPC if available. If not, let's look at sys_users_v2 and see what factory_id is.
    // Wait, let's see what happens if we query operator_attendance, or sys_users_v2
    const { data: users, error: uError } = await supabase
        .from('sys_users_v2')
        .select('factory_id')
        .limit(10);
    
    console.log("sys_users_v2 factory_id sample:", users);

    // Let's query operator_attendance factory_id sample
    const { data: attendance, error: aError } = await supabase
        .from('operator_attendance')
        .select('machine_id')
        .limit(5);
    console.log("operator_attendance machine_id sample:", attendance);

    // Let's check if there is a table called 'sys_factories' or 'sys_locations' or similar by doing a dummy select
    const tables = ['sys_factories', 'sys_locations', 'factories', 'locations', 'sys_factories_v2'];
    for (const t of tables) {
        const { data, error } = await supabase.from(t).select('*').limit(5);
        if (!error) {
            console.log(`\nTable "${t}" exists! Data:`, data);
        } else {
            console.log(`Table "${t}" does not exist or failed:`, error.message);
        }
    }
}

main().catch(console.error);
