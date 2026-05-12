const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function sumBefore25() {
    let allLedger = [];
    let page = 0;
    while(true) {
        const { data } = await supabase
            .from('stock_ledger_v2')
            .select('timestamp, event_type, change_qty, loc_id, notes, ref_doc')
            .eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED')
            .eq('loc_id', 'OPM Lama')
            .lt('timestamp', '2026-04-25T00:00:00Z')
            .range(page * 1000, (page + 1) * 1000 - 1);
        if (!data || data.length === 0) break;
        allLedger = allLedger.concat(data);
        page++;
    }
    
    let sum = 0;
    allLedger.forEach(log => {
        sum += log.change_qty;
    });
    
    console.log(`Total rows before Apr 25: ${allLedger.length}`);
    console.log(`True Raw SUM of all rows before Apr 25 for MERAH at OPM Lama: ${sum}`);
}

sumBefore25();
