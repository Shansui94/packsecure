import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const orderId = '06aa821f-57f5-49a3-aca4-b1daa572c1cb';
    const orderNo = 'DO-Yashin-260620-002';

    console.log(`Checking order ${orderNo} current updated_at time...`);

    // 1. 获取当前行
    const { data: order, error: getErr } = await supabase
        .from('sales_orders')
        .select('updated_at, status')
        .eq('id', orderId)
        .maybeSingle();

    if (getErr) {
        console.error("Error getting order:", getErr);
        return;
    }

    if (!order) {
        console.error(`Order with ID ${orderId} not found.`);
        return;
    }

    console.log(`Order status: ${order.status}`);
    console.log(`Order last updated at: ${order.updated_at}`);

    // 2. 将状态改回 Loaded
    console.log(`Updating status to 'Loaded'...`);
    const { data: updated, error: updateErr } = await supabase
        .from('sales_orders')
        .update({ status: 'Loaded' })
        .eq('id', orderId)
        .select();

    if (updateErr) {
        console.error("Error updating order status:", updateErr);
        return;
    }

    console.log("Update success!");
    console.log(`New status is: ${updated[0].status}`);
}

run();
