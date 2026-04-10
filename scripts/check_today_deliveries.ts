import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    // Check orders delivered today (April 8)
    const { data: orders } = await supabase
        .from('sales_orders')
        .select('order_number, pod_timestamp, items, status')
        .gte('pod_timestamp', '2026-04-07T16:00:00Z'); // After April 8 00:00 MYT

    console.log(`Orders delivered today: ${orders?.length}`);
    if (orders) {
        for (const o of orders) {
            console.log(`- ${o.order_number}`);
        }
    }
}
run();
