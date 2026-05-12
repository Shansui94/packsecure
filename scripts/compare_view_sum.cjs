const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkViewDef() {
    const { data, error } = await supabase.from('v2_inventory_view').select('current_stock').eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED').eq('loc_id', 'OPM Lama');
    console.log("View output:", data);
    
    // Calculate raw sum in ledger
    const { data: sumData } = await supabase.from('stock_ledger_v2').select('change_qty').eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED').eq('loc_id', 'OPM Lama');
    const rawSum = sumData.reduce((acc, row) => acc + row.change_qty, 0);
    console.log("Raw Sum of change_qty:", rawSum);
}

checkViewDef();
