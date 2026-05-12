const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkSum() {
    console.log("Checking Sum...");
    const { data } = await supabase
        .from('stock_ledger_v2')
        .select('change_qty')
        .eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED')
        .eq('loc_id', 'OPM Lama');
        
    let sum = 0;
    data.forEach(r => sum += r.change_qty);
    console.log("Total Sum in Ledger for MERAH at OPM Lama:", sum);
}

checkSum();
