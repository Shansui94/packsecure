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
    const sku = 'BW-SL-CLR-100Mx25CMx4ROLL-GRN'; // SL-25CM
    console.log(`=== Querying all stock_ledger_v2 transactions for ${sku} ===`);
    
    // We will query the ledger directly
    const { data: ledger, error } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('sku', sku);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Total transactions: ${ledger.length}`);
    
    const sumsByLoc = {};
    ledger.forEach(l => {
        const loc = l.loc_id || 'null';
        sumsByLoc[loc] = (sumsByLoc[loc] || 0) + Number(l.change_qty);
    });
    console.log("Sums by location:", sumsByLoc);

    // Let's print the most significant transactions (e.g. ones with absolute change_qty > 10)
    console.log("\nSignificant transactions:");
    ledger.forEach((l, idx) => {
        if (Math.abs(l.change_qty) >= 5 || l.ref_doc === 'AUDIT-20260624') {
            console.log(`${idx + 1}. [${l.timestamp}] Qty: ${l.change_qty} | Loc: ${l.loc_id} | Event: ${l.event_type} | Ref: ${l.ref_doc} | Notes: ${l.notes}`);
        }
    });
}

main().catch(console.error);
