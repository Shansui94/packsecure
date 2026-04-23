import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const { data, error } = await supabase.from('delivery_rates').upsert(
        { 
            origin: 'TEST', 
            location_name: 'TEST_LOC', 
            base_rate: 10, 
            max_places: 3,
            extra_rate_per_place: 2,
            notes: 'Test note' 
        },
        { onConflict: 'origin, location_name' }
    );
    console.log("Error:", error);
    console.log("Data:", data);
}

run();
