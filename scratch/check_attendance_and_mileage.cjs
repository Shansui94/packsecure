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
    console.log("=== Querying lorry_mileage_logs ===");
    const { data: logs, error: err1 } = await supabase
        .from('lorry_mileage_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
    if (err1) console.error("Error lorry_mileage_logs:", err1);
    else console.log("lorry_mileage_logs:", JSON.stringify(logs, null, 2));

    console.log("\n=== Querying driver_shifts ===");
    const { data: shifts, error: err2 } = await supabase
        .from('driver_shifts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
    if (err2) console.error("Error driver_shifts:", err2);
    else console.log("driver_shifts:", JSON.stringify(shifts, null, 2));
}

main().catch(console.error);
