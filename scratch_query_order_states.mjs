import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkOrderDetails() {
    console.log("=== Querying Order States for 'DO-Ameer-260619-001' ===");
    
    // 1. 查询 sales_orders 表
    const { data: soOrder, error: soError } = await supabase
        .from('sales_orders')
        .select('id, order_number, status, driver_id, notes, delivery_date')
        .eq('order_number', 'DO-Ameer-260619-001')
        .maybeSingle();

    if (soError) {
        console.error("Sales Orders Query Error:", soError);
    } else if (soOrder) {
        console.log("Sales Orders table record:");
        console.log(`- ID: ${soOrder.id}`);
        console.log(`- Order Number: ${soOrder.order_number}`);
        console.log(`- Status: ${soOrder.status}`);
        console.log(`- Driver: ${soOrder.driver_id}`);
        console.log(`- Delivery Date: ${soOrder.delivery_date}`);
        console.log(`- Notes: ${soOrder.notes}`);
    } else {
        console.log("No record found in sales_orders table.");
    }

    console.log("-----------------------------------------");

    // 2. 查询 delivery_orders 表
    const { data: doOrder, error: doError } = await supabase
        .from('delivery_orders')
        .select('*')
        .eq('id', 'DO-Ameer-260619-001')
        .maybeSingle();

    if (doError) {
        console.error("Delivery Orders Query Error:", doError);
    } else if (doOrder) {
        console.log("Delivery Orders table record:");
        console.log(JSON.stringify(doOrder, null, 2));
    } else {
        // 尝试用 order_number 模糊匹配 ID
        const { data: doOrders, error: doError2 } = await supabase
            .from('delivery_orders')
            .select('*')
            .ilike('id', '%Ameer%');
        
        if (doError2) {
            console.error("Delivery Orders Query Error 2:", doError2);
        } else {
            console.log("Delivery Orders matching 'Ameer':");
            doOrders.forEach(o => console.log(`- ID: ${o.id}, Status: ${o.status}, Driver: ${o.driver_id}`));
        }
    }
}

checkOrderDetails();
