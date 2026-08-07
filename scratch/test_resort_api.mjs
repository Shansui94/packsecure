import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
    console.log("Testing update on sales_orders...");
    // Let's try to update the sequence of Yashin's orders to 999 (neutral write test)
    const orderId = "356abde3-9cde-454a-ad89-102e4a6d6abc"; // DO-Yashin-260722-002
    
    const { data, error } = await supabase
        .from('sales_orders')
        .update({ trip_sequence: 999 })
        .eq('id', orderId)
        .select();

    if (error) {
        console.error("Error performing update:", error);
    } else {
        console.log("Update success! Returned data:", data);
    }
}

testUpdate();
