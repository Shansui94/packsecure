const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkMaster() {
    const { data } = await supabase.from('master_items_v2').select('*').eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED');
    console.log("Master Items:", data);
}

checkMaster();
