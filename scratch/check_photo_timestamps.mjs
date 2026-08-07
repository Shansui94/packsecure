import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const ids = [
        'DO-Ayam-260611-001',
        'DO-Mahadi-260611-001',
        'DO-Faizal-260610-001',
        'DO-Tahir-260610-001',
        'DO-Ayam-260610-002',
        'DO-WAN-260610-002',
        'DO-Neoson-260611-001',
        'DO-Tahir-260611-001',
        'DO-yan-260610-002',
        'DO-Waldan-260611-001',
        'DO-Khairol-260611-001',
        'DO-Bob-260611-002',
        'DO-yan-260610-003',
        'DO-SAM-260611-001',
        'DO-Dean-260610-001',
        'DO-Ameer-260611-002'
    ];

    console.log("=== Checking photo upload timestamps ===");
    const { data: orders, error } = await s
        .from('sales_orders')
        .select('order_number, pod_timestamp, pod_photo_url')
        .in('order_number', ids);

    if (error) {
        console.error(error.message);
        return;
    }

    orders.forEach(o => {
        console.log(`Order: ${o.order_number}`);
        console.log(`  POD Timestamp: ${o.pod_timestamp}`);
        console.log(`  POD Photo URLs: ${o.pod_photo_url ? o.pod_photo_url.split(',').length + " photos" : "none"}`);
    });
}

run();
