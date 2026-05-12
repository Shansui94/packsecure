const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check4PMExact() {
    const { data: logs } = await supabase
        .from('stock_ledger_v2')
        .select('timestamp, event_type, change_qty, notes, ref_doc')
        .gte('timestamp', '2026-04-28T07:55:00Z') // 15:55 MYT
        .lte('timestamp', '2026-04-28T08:05:00Z') // 16:05 MYT
        .order('timestamp', { ascending: true });
        
    logs.forEach(l => {
        const d = new Date(l.timestamp);
        // Do not add 8 hours if it's already local, just print ISO string to see UTC
        console.log(`UTC: ${l.timestamp} | ${l.event_type} | ${l.change_qty} | ${l.ref_doc || l.notes}`);
    });
}

check4PMExact();
