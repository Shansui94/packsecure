const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkNilaiHistory() {
    const sku = 'BW-SL-CLR-100Mx100CMx1ROLL-RED';
    
    const { data: logs } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('sku', sku)
        .eq('loc_id', 'Nilai');
        
    const total = logs.reduce((sum, log) => sum + Number(log.change_qty), 0);
    console.log("Total for Nilai directly from Ledger:", total);
}

checkNilaiHistory();
