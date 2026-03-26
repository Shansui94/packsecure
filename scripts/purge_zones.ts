import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function purgeZones() {
    const legacyZones = ['North', 'Central', 'Central_Left', 'Central_Right', 'South', 'East'];

    console.log("Purging legacy zones from sales_orders...");
    const { data, error, count } = await supabase
        .from('sales_orders')
        .update({ zone: null })
        .in('zone', legacyZones)
        .select('id, zone');

    if (error) {
        console.error("Purge Error:", error);
    } else {
        console.log(`Successfully purged ${data?.length} orders containing legacy zones.`);
    }
}

purgeZones();
