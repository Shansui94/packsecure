const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check4PM() {
    const { data: logs } = await supabase
        .from('stock_ledger_v2')
        .select('timestamp, event_type, change_qty, notes, ref_doc')
        .gte('timestamp', '2026-04-28T07:00:00Z') // 15:00 MYT
        .lte('timestamp', '2026-04-28T09:00:00Z') // 17:00 MYT
        .order('timestamp', { ascending: false });
        
    let countMap = {};
    logs.forEach(l => {
        const d = new Date(l.timestamp);
        d.setHours(d.getHours() + 8); // MYT
        const hour = d.getHours();
        const min = d.getMinutes();
        const timeStr = `${hour}:${min < 10 ? '0'+min : min}`;
        
        if (!countMap[timeStr]) countMap[timeStr] = 0;
        countMap[timeStr]++;
    });
    
    console.log("Activity around 4 PM MYT:");
    console.table(countMap);
}

check4PM();
