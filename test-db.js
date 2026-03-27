require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("Fetching delivery_rates...");
    const { data: rates, error } = await supabase.from('delivery_rates').select('*').limit(10);
    if (error) console.error("Error rates:", error);
    else console.log("RATES:", rates);
    
    console.log("Fetching sales_orders structure...");
    const { data: cols } = await supabase.from('sales_orders').select('*').limit(1);
    console.log("COLS:", Object.keys(cols?.[0] || {}));
}
run();
