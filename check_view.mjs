import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // Get sales_orders schema
    const { data: orders } = await supabase.from('sales_orders').select('*').limit(2);
    if (orders && orders[0]) {
        console.log('=== sales_orders columns ===');
        console.log(Object.keys(orders[0]).join('\n'));
        console.log('\n=== Sample row ===');
        console.log(JSON.stringify(orders[0], null, 2));
    } else {
        console.log('No sales_orders data or no access');
    }

    // Check if zone_trip_rates table exists
    const { data: ztr, error } = await supabase.from('zone_trip_rates').select('*').limit(3);
    console.log('\n=== zone_trip_rates ===', ztr || error?.message);
}
run();
