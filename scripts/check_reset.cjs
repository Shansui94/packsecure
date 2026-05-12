const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkReset() {
    const { data } = await supabase
        .from('stock_ledger_v2')
        .select('timestamp, change_qty, event_type')
        .eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED')
        .eq('loc_id', 'OPM Lama')
        .eq('event_type', 'System Reset');
        
    console.log("System Resets:", data);
}

checkReset();
