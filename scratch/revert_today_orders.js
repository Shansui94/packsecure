import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const reversions = [
        { order: 'DO-Taufik-260709-001', status: 'Pending Approval' },
        { order: 'DO-WAN-260709-001', status: 'New' },
        { order: 'DO-WAN-260709-002', status: 'Pending Approval' },
        { order: 'DO-yan-260709-001', status: 'New' },
        { order: 'DO-Yashin-260709-001', status: 'Pending Approval' },
        { order: 'DO-yan-260709-002', status: 'New' },
        { order: 'DO-Dean-260709-001', status: 'Loaded' }
    ];

    console.log("=== Reverting 7 mistakenly completed today's orders ===");

    for (const r of reversions) {
        console.log(`Reverting ${r.order} to status: ${r.status}`);
        
        const { error } = await supabase
            .from('sales_orders')
            .update({
                status: r.status,
                pod_timestamp: null,
                notes: null
            })
            .eq('order_number', r.order);

        if (error) {
            console.error(`Error reverting ${r.order}:`, error.message);
        }
    }

    console.log("=== Reversion complete ===");
}

run();
