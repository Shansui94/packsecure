const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkRefunds() {
    console.log("Checking Cancellation Refunds...");
    const { data: refunds } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('event_type', 'Cancellation Refund')
        .eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED')
        .gt('timestamp', '2026-04-23T16:39:32+00:00');
        
    console.log(refunds);
}

checkRefunds();
