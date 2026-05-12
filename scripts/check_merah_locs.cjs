const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkMerahLocs() {
    const { data: logs } = await supabase
        .from('stock_ledger_v2')
        .select('ref_doc, change_qty, loc_id, timestamp')
        .eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED')
        .gte('timestamp', '2026-04-27T16:00:00+00:00') // MYT 28th 00:00
        .eq('event_type', 'Transfer Out')
        .like('notes', '%Delivered%');
        
    console.log(logs);
}

checkMerahLocs();
