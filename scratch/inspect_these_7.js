import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const orderNumbers = [
        'DO-Taufik-260709-001',
        'DO-WAN-260709-001',
        'DO-WAN-260709-002',
        'DO-yan-260709-001',
        'DO-Yashin-260709-001',
        'DO-yan-260709-002',
        'DO-Dean-260709-001'
    ];

    const { data: orders, error } = await supabase
        .from('sales_orders')
        .select('id, order_number, status, driver_id, created_at, deadline, proof_of_load_url, trip_id, notes')
        .in('order_number', orderNumbers);

    if (error) {
        console.error(error);
        return;
    }

    orders.forEach(o => {
        console.log(`Order: ${o.order_number}`);
        console.log(`  Driver ID: ${o.driver_id}`);
        console.log(`  Trip ID: ${o.trip_id}`);
        console.log(`  Proof of Load URL: ${o.proof_of_load_url ? 'Has URL' : 'Null'}`);
        console.log(`  Created At: ${o.created_at}`);
        console.log(`  Deadline: ${o.deadline}`);
        console.log(`  Notes: ${o.notes}`);
    });
}

check();
