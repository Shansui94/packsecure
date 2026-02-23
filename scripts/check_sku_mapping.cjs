const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const [masterItems, activeProds, prodsV2] = await Promise.all([
        sb.from('master_items_v2').select('sku, name').limit(30),
        sb.from('machine_active_products').select('*'),
        sb.from('products_v2').select('sku, name').limit(10)
    ]);

    let out = '=== master_items_v2 (valid SKUs for stock_ledger_v2) ===\n';
    if (masterItems.error) out += 'ERROR: ' + masterItems.error.message + '\n';
    else masterItems.data?.forEach(r => out += r.sku + ' | ' + r.name + '\n');

    out += '\n=== machine_active_products (current) ===\n';
    if (activeProds.error) out += 'ERROR: ' + activeProds.error.message + '\n';
    else activeProds.data?.forEach(r => out += r.machine_id + ' | ' + r.lane_id + ' | SKU: ' + r.product_sku + '\n');

    out += '\n=== products_v2 ===\n';
    if (prodsV2.error) out += 'ERROR: ' + prodsV2.error.message + '\n';
    else prodsV2.data?.forEach(r => out += r.sku + ' | ' + r.name + '\n');

    fs.writeFileSync(require('path').resolve(__dirname, '../sku_mapping.txt'), out);
    console.log('Done');
}
main().catch(console.error);
