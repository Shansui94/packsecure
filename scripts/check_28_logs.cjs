const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check28Logs() {
    const { data: logs } = await supabase
        .from('stock_ledger_v2')
        .select('timestamp, event_type, change_qty, sku, notes, ref_doc')
        .gte('timestamp', '2026-04-28T00:00:00Z')
        .lte('timestamp', '2026-04-29T00:00:00Z')
        .order('timestamp', { ascending: false })
        .limit(20);
        
    console.log("Logs on April 28th:");
    logs.forEach(l => console.log(`${l.timestamp} | ${l.event_type} | ${l.change_qty} | ${l.notes} | ${l.sku}`));
}

check28Logs();
