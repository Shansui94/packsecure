const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check1000() {
    const { data } = await supabase
        .from('stock_ledger_v2')
        .select('change_qty')
        .eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED')
        .eq('loc_id', 'OPM Lama')
        .order('timestamp', { ascending: false })
        .limit(1000);
        
    let sum = 0;
    data.forEach(d => sum += d.change_qty);
    console.log("Sum of LAST 1000 rows:", sum);
}

check1000();
