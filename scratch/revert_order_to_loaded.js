import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function revert() {
    const orderNumber = 'DO-Khairol-260801-001';
    console.log(`Reverting order ${orderNumber} to 'Loaded' status...`);

    const { data, error } = await supabase
        .from('sales_orders')
        .update({ status: 'Loaded' })
        .eq('order_number', orderNumber)
        .select('id, order_number, status');

    if (error) {
        console.error("Revert failed:", error);
    } else {
        console.log("Successfully reverted order:", data);
    }
}
revert();
