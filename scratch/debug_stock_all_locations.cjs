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
    console.log("=== Querying v2_inventory_view for all 19 audited items ===");
    
    const { data: auditRecords, error: err0 } = await supabase
        .from('stock_ledger_v2')
        .select('sku')
        .eq('ref_doc', 'AUDIT-20260624');

    if (err0) {
        console.error("Error fetching audited SKUs:", err0);
        return;
    }

    const skus = Array.from(new Set(auditRecords.map(r => r.sku)));

    const { data: inv, error: err1 } = await supabase
        .from('v2_inventory_view')
        .select('*')
        .in('sku', skus);

    if (err1) {
        console.error("Error fetching inventory view:", err1);
        return;
    }

    // Group by SKU and print
    const grouped = {};
    inv.forEach(r => {
        if (!grouped[r.name]) grouped[r.name] = [];
        grouped[r.name].push({ loc: r.loc_id, stock: r.current_stock });
    });

    console.log(JSON.stringify(grouped, null, 2));
}

main().catch(console.error);
