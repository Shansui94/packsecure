import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
    const orders = ['DO-Ameer-260709-001', 'DO-Dean-260709-001'];
    
    for (const orderNumber of orders) {
        console.log(`\n=== Details for ${orderNumber} ===`);
        const { data: order, error } = await supabase
            .from('sales_orders')
            .select('*')
            .eq('order_number', orderNumber)
            .maybeSingle();

        if (error) {
            console.error(error);
        } else if (!order) {
            console.log("Not found");
        } else {
            console.log(JSON.stringify(order, null, 2));
        }
    }
}

run();
