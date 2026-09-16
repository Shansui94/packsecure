import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTripTables() {
    const candidates = ['trips', 'logistics_trips', 'delivery_trips', 'fleet_trips'];
    for (const t of candidates) {
        const { data, error } = await supabase.from(t).select('*').limit(1);
        if (error) {
            console.log(`Table '${t}': error -> ${error.message}`);
        } else {
            console.log(`Table '${t}' EXISTS! rows:`, data.length);
        }
    }
}

checkTripTables().catch(console.error);
