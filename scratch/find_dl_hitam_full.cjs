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
    console.log("=== Searching master_items_v2 for DL Hitam Full ===");
    const { data: items, error: itemErr } = await supabase
        .from('master_items_v2')
        .select('*')
        .or('name.ilike.%dl%,sku.ilike.%dl%');

    if (itemErr) {
        console.error(itemErr);
        return;
    }

    // Filter items matching 'hitam' / 'blk' / 'black'
    const dlHitamItems = items.filter(i => {
        const str = JSON.stringify(i).toLowerCase();
        return str.includes('hitam') || str.includes('blk') || str.includes('black');
    });

    console.log("Found matching master items:", dlHitamItems);

    // Let's query recent stock ledger transactions for these SKUs to see what happened!
    const skus = dlHitamItems.map(i => i.sku);
    if (skus.length > 0) {
        console.log(`\n=== Querying stock_ledger_v2 for SKUs: ${skus.join(', ')} ===`);
        const { data: ledger, error: ledgErr } = await supabase
            .from('stock_ledger_v2')
            .select('*')
            .in('sku', skus)
            .order('timestamp', { ascending: false })
            .limit(50);

        if (ledgErr) {
            console.error(ledgErr);
        } else {
            console.log(`Found ${ledger.length} recent ledger transactions:`);
            ledger.forEach(l => {
                console.log(`- [${l.timestamp}] Txn: ${l.txn_id} | SKU: ${l.sku} | Loc: ${l.loc_id} | Qty: ${l.change_qty} | Event: ${l.event_type} | Ref: ${l.ref_doc} | Notes: ${l.notes}`);
            });
        }
    }
}

main().catch(console.error);
