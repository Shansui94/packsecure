const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check3929() {
    const { data: order } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('order_number', 'DO-2026-3929')
        .single();
        
    console.log("Order Data:", order);
    
    const { data: logs } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('ref_doc', 'DO-2026-3929');
        
    console.log("Ledger Logs:", logs);
}

check3929();
