const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkCreator() {
    const { data: logs } = await supabase
        .from('stock_ledger_v2')
        .select('created_by, created_by_name, notes, ref_doc, timestamp, event_type')
        .eq('timestamp', '2026-04-28T08:00:00+00:00');
        
    console.log(`Found ${logs.length} logs at exact timestamp 08:00:00Z`);
    if (logs.length > 0) {
        let creators = new Set();
        logs.forEach(l => creators.add(`${l.created_by} | ${l.created_by_name}`));
        console.log("Creators:", [...creators]);
        console.log("Sample Ref Docs:", logs.slice(0, 5).map(l => l.ref_doc));
    }
}

checkCreator();
