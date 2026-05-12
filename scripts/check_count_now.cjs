const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkCount() {
    const { count, error } = await supabase
        .from('stock_ledger_v2')
        .select('*', { count: 'exact', head: true })
        .eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED')
        .eq('loc_id', 'OPM Lama');
        
    console.log("Total rows for MERAH at OPM Lama NOW:", count);
}

checkCount();
