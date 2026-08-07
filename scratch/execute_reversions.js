import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const noLoadOrders = [
        'DO-Tahir-260629-001',
        'DO-Eric-260624-001',
        'DO-Neoson-260603-001',
        'DO-Dean-260626-001',
        'DO-Neoson-260708-001',
        'DO-Eric-260708-001',
        'DO-Yashin-260703-001',
        'DO-HQ-260627-001',
        'DO-yan-260626-002',
        'DO-SAM-260704-001',
        'DO-Neoson-260706-001'
    ];

    const lateLoadOrders = [
        'DO-Bob-260709-001',
        'DO-Bob-260709-002',
        'DO-Bob-260709-003'
    ];

    console.log("=== Reverting un-loaded orders (no proof of load) to 'New' ===");
    for (const o of noLoadOrders) {
        console.log(`Reverting ${o} to New`);
        const { error } = await supabase
            .from('sales_orders')
            .update({
                status: 'New',
                pod_timestamp: null,
                notes: null
            })
            .eq('order_number', o);

        if (error) {
            console.error(`Error reverting ${o}:`, error.message);
        }
    }

    console.log("\n=== Reverting late loaded orders (loaded after 4 PM yesterday) to 'Loaded' ===");
    for (const o of lateLoadOrders) {
        console.log(`Reverting ${o} to Loaded`);
        const { error } = await supabase
            .from('sales_orders')
            .update({
                status: 'Loaded',
                pod_timestamp: null,
                notes: null
            })
            .eq('order_number', o);

        if (error) {
            console.error(`Error reverting ${o}:`, error.message);
        }
    }

    console.log("\n=== All reversions executed ===");
}

run();
