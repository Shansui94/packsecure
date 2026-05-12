const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkStock() {
    const { data: stock, error } = await supabase
        .from('v2_inventory_view')
        .select('*')
        .in('sku', ['BW-SL-CLR-100Mx100CMx1ROLL-RED', 'BW-SL-CLR-100Mx50CMx2ROLL-ORN']);
    
    console.log(stock);
}

checkStock();
