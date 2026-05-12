const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkWho() {
    const { data: order } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('order_number', 'DO-Mahadi-260209-003')
        .single();
        
    console.log("Order Data:", order);
    
    // Check stock_ledger_v2 for this order to see if created_by_name exists
    const { data: ledger } = await supabase
        .from('stock_ledger_v2')
        .select('created_by, created_by_name')
        .eq('ref_doc', 'DO-Mahadi-260209-003')
        .limit(1);
        
    console.log("Ledger Data:", ledger);
}

checkWho();
