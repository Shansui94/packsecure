const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check28thDeliveries() {
    const { data: logs } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .gte('timestamp', '2026-04-28T00:00:00+08:00') // MYT 28th start
        .lte('timestamp', '2026-04-28T23:59:59+08:00') // MYT 28th end
        .eq('event_type', 'Transfer Out')
        .like('notes', '%Order Delivered%');
        
    console.log("Valid Deliveries on 28th:", logs.length);
    console.log(logs.slice(0, 3).map(l => l.ref_doc + " | " + l.notes + " | " + l.timestamp));
}

check28thDeliveries();
