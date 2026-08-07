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
    const { data, error } = await supabase
        .from('stock_ledger_v2')
        .select('sku, loc_id, change_qty, notes')
        .eq('ref_doc', 'AUDIT-20260624');

    if (error) {
        console.error(error);
    } else {
        console.log("Audited items in database:");
        data.forEach(r => {
            console.log(`SKU: "${r.sku}" | Loc: "${r.loc_id}" | Qty: ${r.change_qty} | Notes: "${r.notes}"`);
        });
    }
}

main().catch(console.error);
