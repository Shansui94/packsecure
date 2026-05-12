const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkProd() {
    const { data } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('event_type', 'Production')
        .eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED')
        .order('timestamp', { ascending: false })
        .limit(20);
        
    console.log(data.map(d => `${d.timestamp} | ${d.change_qty} | ${d.notes}`));
}

checkProd();
