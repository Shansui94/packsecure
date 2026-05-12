const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkV1Ledger() {
    const { data: v1Sum } = await supabase.from('stock_ledger').select('change_amount').eq('item_sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED');
    const sum = v1Sum?.reduce((acc, row) => acc + Number(row.change_amount), 0) || 0;
    console.log("V1 Ledger Sum:", sum);
}

checkV1Ledger();
