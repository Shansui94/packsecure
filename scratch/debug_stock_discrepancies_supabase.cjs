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
    console.log("=== Querying stock from Supabase REST API ===");

    // Find the 19 SKUs from Baby's audit
    const { data: auditRecords, error: err0 } = await supabase
        .from('stock_ledger_v2')
        .select('sku')
        .eq('ref_doc', 'AUDIT-20260624');

    if (err0) {
        console.error(err0);
        return;
    }

    const skus = Array.from(new Set(auditRecords.map(r => r.sku)));
    console.log(`Audited SKUs:`, skus);

    const { data: inv, error: err1 } = await supabase
        .from('v2_inventory_view')
        .select('*')
        .in('sku', skus)
        .order('sku', { ascending: true });

    if (err1) {
        console.error(err1);
        return;
    }

    console.log("\n=== Inventory View Rows for Audited SKUs ===");
    inv.forEach(r => {
        console.log(`SKU: ${r.sku} | Name: ${r.name} | Loc: ${r.loc_id} | Stock: ${r.current_stock}`);
    });
}

main().catch(console.error);
