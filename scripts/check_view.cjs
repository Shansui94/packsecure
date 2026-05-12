const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkView() {
    console.log("Checking View...");
    const { data, error } = await supabase.rpc('get_view_definition', { view_name: 'v2_inventory_view' });
    console.log(data || error);
    
    // Actually we can just do a query on it
    const { data: v } = await supabase.from('v2_inventory_view').select('*').eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED').eq('loc_id', 'OPM Lama');
    console.log(v);
}

checkView();
