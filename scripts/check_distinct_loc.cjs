const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkDistinctLoc() {
    const { data } = await supabase
        .from('stock_ledger_v2')
        .select('loc_id, change_qty')
        .eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED');
        
    const map = {};
    data.forEach(d => {
        if (!map[d.loc_id]) map[d.loc_id] = 0;
        map[d.loc_id] += d.change_qty;
    });
    
    console.log(map);
}

checkDistinctLoc();
