import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    const { data, error } = await supabase
        .from('sales_orders')
        .select('id, order_number, driver_id, trip_sequence, deadline, status')
        .ilike('order_number', '%Yashin%')
        .neq('status', 'Delivered')
        .neq('status', 'Cancelled');

    if (error) {
        console.error(error);
        return;
    }
    console.log("Active Yashin Orders in DB:");
    console.log(JSON.stringify(data, null, 2));
}

debug();
