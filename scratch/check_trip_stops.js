import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log("=== Checking trip_stops_v2 ===");
    const { data: stops, error } = await supabase
        .from('trip_stops_v2')
        .select('*')
        .limit(20);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${stops.length} stops.`);
    stops.forEach(s => {
        console.log(`Stop ID: ${s.id}, Order ID: ${s.sales_order_id}, Status: ${s.status}, POD Timestamp: ${s.pod_timestamp}`);
    });
}

check();
