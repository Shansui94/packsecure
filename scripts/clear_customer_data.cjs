const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function clearCustomerData() {
    console.log("Updating all sales_orders to set customer = 'General Customer'...");
    const { data, error } = await supabase
        .from('sales_orders')
        .update({ customer: 'General Customer' })
        .neq('customer', 'General Customer') // only update those that are different
        .select('id');
        
    if (error) {
        console.error("Error updating:", error);
    } else {
        console.log(`Successfully updated ${data.length} orders.`);
    }
}

clearCustomerData();
