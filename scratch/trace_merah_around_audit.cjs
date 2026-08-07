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
    console.log(`=== Querying running stock for ${sku} at OPM Lama ===`);
    const { data: ledger, error } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('sku', sku)
        .eq('loc_id', 'OPM Lama');

    if (error) {
        console.error(error);
        return;
    }

    // Sort locally to make sure it is in order
    ledger.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let balance = 0;
    const thresholdDate = new Date('2026-06-23T00:00:00Z');
    ledger.forEach((l, idx) => {
        balance += Number(l.change_qty);
        const logDate = new Date(l.timestamp);
        if (l.ref_doc === 'AUDIT-20260624' || logDate >= thresholdDate) {
            console.log(`${idx + 1}. [${l.timestamp}] Qty: ${l.change_qty >= 0 ? '+' : ''}${l.change_qty} | Bal: ${balance} | Event: ${l.event_type} | Ref: ${l.ref_doc} | Notes: ${l.notes}`);
        }
    });
}

main().catch(console.error);
