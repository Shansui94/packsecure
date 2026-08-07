const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = 'c:/Users/Max Tan/Downloads/Packsecure OS/packsecure/.env';
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
    console.log("=== Searching for tables containing 'spd' or 'SPD' ===");
    
    // Let's check common tables:
    // 1. driver_delivery / driver_delivery_v2?
    // Let's check what tables are in the public schema first by querying postgres
    const { data: tables, error: tablesErr } = await supabase
        .from('pg_catalog.pg_tables')
        .select('tablename')
        .eq('schemaname', 'public');
    
    if (tablesErr) {
        // Fallback: search known tables
        console.log("pg_tables query failed, searching known tables...");
    } else {
        console.log("Tables in public schema:", tables.map(t => t.tablename));
    }

    const targetTables = ['driver_trips', 'delivery_orders', 'mileage_logs', 'attendance', 'operator_attendance', 'users_public', 'sys_users_v2'];
    
    // We can also query all recent logs/trips for Baby (user ID '4477c368-c139-4cee-b30d-58dc7eba06c8' / auth_user_id '13827bb3-ff87-494c-aff4-c4a4e7152a69' / employee_id '0014')
    const babyUserIds = [
        '4477c368-c139-4cee-b30d-58dc7eba06c8',
        '13827bb3-ff87-494c-aff4-c4a4e7152a69',
        '0014'
    ];

    // Let's query recent driver_trips / delivery_orders / mileage_logs / operator_attendance for Baby
    // First, let's see if we can search for any record where location = 'spd' or 'SPD' or similar.
    // We will query some tables for recent rows:
    
    // Let's check 'driver_trips' table
    try {
        const { data: driverTrips, error: err } = await supabase
            .from('driver_trips')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);
        console.log("driver_trips:", driverTrips);
    } catch(e) { console.error("Error querying driver_trips:", e.message); }

    // Let's check 'mileage_logs'
    try {
        const { data: mileageLogs, error: err } = await supabase
            .from('mileage_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);
        console.log("mileage_logs:", mileageLogs);
    } catch(e) { console.error("Error querying mileage_logs:", e.message); }
}

main().catch(console.error);
