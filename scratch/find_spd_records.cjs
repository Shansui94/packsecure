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
    const babyUserIds = [
        '4477c368-c139-4cee-b30d-58dc7eba06c8',
        '13827bb3-ff87-494c-aff4-c4a4e7152a69',
        '0014'
    ];

    const tablesToSearch = [
        { name: 'lorry_mileage_logs', userCol: 'driver_id' },
        { name: 'driver_shifts', userCol: 'driver_id' },
        { name: 'logistics_trips', userCol: 'driver_id' },
        { name: 'trips', userCol: 'driver_id' },
        { name: 'delivery_orders', userCol: 'driver_id' },
        { name: 'operator_attendance', userCol: 'operator_id' },
        { name: 'attendance', userCol: 'user_id' }
    ];

    console.log("=== SEARCHING FOR 'SPD' OR 'spd' IN DATABASE TABLES ===");

    for (const t of tablesToSearch) {
        try {
            // First, let's query recent records from the table
            const { data, error } = await supabase
                .from(t.name)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                // Try query without created_at order if it fails
                const { data: data2, error: error2 } = await supabase
                    .from(t.name)
                    .select('*')
                    .limit(50);
                if (error2) {
                    console.log(`Table ${t.name}: failed to query:`, error2.message);
                    continue;
                }
                searchInRows(t.name, data2);
            } else {
                searchInRows(t.name, data);
            }
        } catch (e) {
            console.log(`Table ${t.name}: exception:`, e.message);
        }
    }

    function searchInRows(tableName, rows) {
        if (!rows || rows.length === 0) return;
        const matches = [];
        for (const row of rows) {
            const rowStr = JSON.stringify(row).toLowerCase();
            if (rowStr.includes('spd') || rowStr.includes('opm')) {
                matches.push(row);
            }
        }
        if (matches.length > 0) {
            console.log(`\nFound matches in table "${tableName}":`);
            console.log(JSON.stringify(matches, null, 2));
        }
    }
}

main().catch(console.error);
