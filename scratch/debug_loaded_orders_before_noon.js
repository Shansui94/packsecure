import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findOrders() {
    const cutOffTime = '2026-07-28T04:00:00.000Z'; 

    console.log(`Searching for Loaded orders with updated_at < ${cutOffTime}...`);

    const { data: loadedOrders, error } = await supabase
        .from('sales_orders')
        .select('id, order_number, driver_id, status, updated_at, deadline, notes')
        .eq('status', 'Loaded')
        .lt('updated_at', cutOffTime)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error("Query failed:", error);
        return;
    }

    console.log(`Found ${loadedOrders.length} orders matching criteria.`);
    loadedOrders.forEach((o, index) => {
        console.log(`${index + 1}. Order: ${o.order_number}, Driver ID: ${o.driver_id}, Status: ${o.status}, Updated At: ${o.updated_at}, Notes: ${o.notes}`);
    });
}

findOrders();
