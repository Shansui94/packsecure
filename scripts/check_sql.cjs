const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function runSQL() {
    const { data, error } = await supabase.rpc('get_view_definition', { view_name: 'v2_inventory_view' });
    console.log("RPC get_view_definition:", error?.message || data);

    // Let's do a raw REST query that mimics SUM
    const { data: raw, error: rawErr } = await supabase
        .from('stock_ledger_v2')
        .select('change_qty')
        .eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED')
        .eq('loc_id', 'OPM Lama');
        
    let sum = 0;
    raw.forEach(r => sum += Number(r.change_qty));
    console.log("True JS SUM:", sum);
}

runSQL();
