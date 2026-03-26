import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkAlif() {
    console.log("Looking up Alif...");
    const { data: users, error: uErr } = await supabase.from('sys_users_v2').select('*').ilike('name', '%Alif%');
    if (uErr) return console.error(uErr);
    if (!users || users.length === 0) return console.log("No Alif found.");
    
    const alifId = users[0].auth_user_id;

    // Fetch ALL Alif trips
    const { data: trips, error: tErr } = await supabase
        .from('sales_orders')
        .select('id, order_number, status, order_date, pod_timestamp, trip_origin, zone, delivery_address')
        .eq('driver_id', alifId);

    if (tErr) return console.error(tErr);
    
    fs.writeFileSync('alif_all_trips.json', JSON.stringify(trips, null, 2));
    console.log(`Saved ${trips?.length} total trips for Alif.`);
}

checkAlif();
