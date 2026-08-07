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
    const sku = 'BW-DL-BLK-100Mx100CMx1ROLL-RED'; // DL Hitam Full
    console.log(`=== Querying recent 20 stock ledger transactions for ${sku} ===`);
    const { data: ledger, error } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('sku', sku)
        .order('timestamp', { ascending: false })
        .limit(20);

    if (error) {
        console.error(error);
        return;
    }

    ledger.forEach((l, idx) => {
        console.log(`${idx + 1}. [${l.timestamp}] Qty: ${l.change_qty} | Event: ${l.event_type} | Loc: ${l.loc_id} | Notes: ${l.notes} | CreatedBy: ${l.created_by_name || l.created_by}`);
    });
}

main().catch(console.error);
