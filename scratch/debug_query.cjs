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
    const sku = 'BW-SL-CLR-100Mx100CMx1ROLL-RED'; // MERAH
    const { data, error } = await supabase
        .from('stock_ledger_v2')
        .select('txn_id')
        .eq('sku', sku)
        .eq('loc_id', 'OPM Lama');

    console.log("Error:", error);
    console.log("Data length:", data ? data.length : 'null');
}

main().catch(console.error);
