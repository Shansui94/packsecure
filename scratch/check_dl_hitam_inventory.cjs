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
    const sku = 'BW-DL-BLK-100Mx100CMx1ROLL-RED';
    console.log(`=== Querying v2_inventory_view for ${sku} ===`);
    const { data: inv, error: err1 } = await supabase
        .from('v2_inventory_view')
        .select('*')
        .eq('sku', sku);

    if (err1) console.error("Error v2_inventory_view:", err1);
    else console.log("Inventory View entries:", inv);

    console.log(`\n=== Summing stock_ledger_v2 by location for ${sku} ===`);
    const { data: ledger, error: err2 } = await supabase
        .from('stock_ledger_v2')
        .select('loc_id, change_qty')
        .eq('sku', sku);

    if (err2) {
        console.error(err2);
        return;
    }

    const sums = {};
    ledger.forEach(l => {
        const loc = l.loc_id || 'null/unknown';
        sums[loc] = (sums[loc] || 0) + l.change_qty;
    });

    console.log("Calculated Stock by Location:", sums);
    
    // Sum across all locations
    let total = 0;
    Object.values(sums).forEach(v => total += v);
    console.log("Total Stock in all locations:", total);
}

main().catch(console.error);
