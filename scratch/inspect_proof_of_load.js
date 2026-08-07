import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log("=== Inspecting proof_of_load_url timestamps ===");
    
    const { data: orders, error } = await supabase
        .from('sales_orders')
        .select('id, order_number, status, driver_id, created_at, deadline, proof_of_load_url')
        .not('proof_of_load_url', 'is', null);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${orders.length} orders with proof of load.`);
    orders.slice(0, 30).forEach(o => {
        const url = o.proof_of_load_url;
        // Extract timestamp from filename like load_DO-Bob-260709-001_1765386889000.jpg
        const match = url.match(/_(\d{13})\./);
        if (match) {
            const ms = parseInt(match[1], 10);
            const date = new Date(ms);
            console.log(`Order: ${o.order_number}, Status: ${o.status}, LoadedAt: ${date.toISOString()} (Local: ${date.toLocaleString('zh-CN', { timeZone: 'Asia/Kuala_Lumpur' })})`);
        } else {
            console.log(`Order: ${o.order_number}, Status: ${o.status}, URL: ${url}`);
        }
    });
}

check();
