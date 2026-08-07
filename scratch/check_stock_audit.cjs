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
    const babyUser = {
        id: '4477c368-c139-4cee-b30d-58dc7eba06c8',
        auth_user_id: '13827bb3-ff87-494c-aff4-c4a4e7152a69',
        employee_id: '0014'
    };

    console.log("=== Querying Stock Ledger for Baby or SPD location ===");

    // Let's query recent stock ledger transactions ordered by timestamp desc
    const { data: recentLedger, error: err1 } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(300);

    if (err1) {
        console.error("Error reading stock_ledger_v2:", err1);
        return;
    }

    const matches = [];
    recentLedger.forEach(row => {
        const str = JSON.stringify(row).toLowerCase();
        // Look for 'spd' or Baby's UUID/id
        if (row.loc_id?.toLowerCase() === 'spd' || row.created_by === babyUser.id || row.created_by === babyUser.auth_user_id) {
            matches.push(row);
        }
    });

    console.log(`Found ${matches.length} matching rows in stock_ledger_v2:`);
    console.log(JSON.stringify(matches, null, 2));
}

main().catch(console.error);
