const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkFirst28() {
    const { data: logs } = await supabase
        .from('stock_ledger_v2')
        .select('timestamp, event_type')
        .gte('timestamp', '2026-04-27T16:00:00Z') // 28th 00:00 MYT
        .lte('timestamp', '2026-04-28T16:00:00Z') // 29th 00:00 MYT
        .eq('event_type', 'Production')
        .order('timestamp', { ascending: true })
        .limit(5);
        
    console.log("First Production logs on April 28th (MYT):");
    logs.forEach(l => {
        const d = new Date(l.timestamp);
        // Add 8 hours for MYT
        d.setHours(d.getHours() + 8);
        console.log(`MYT: ${d.toISOString().replace('Z', '+08:00')} | UTC: ${l.timestamp}`);
    });
}

checkFirst28();
