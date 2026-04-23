import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    // Attempt an insert without service role? Not possible since the key is service role.
    
    // Let's attempt an insert with service role first just to see if the table accepts the payload.
    const payload = { 
        origin: 'TAIPING', 
        location_name: 'TEST_MANUAL_123', 
        base_rate: 10, 
        max_places: 3,
        extra_rate_per_place: 2,
        notes: 'test' 
    };

    console.log("Attempting insert...");
    const { data, error } = await supabase.from('delivery_rates').insert(payload).select();
    console.log("Error:", error);
    console.log("Data inserted:", data);

    if (data && data.length > 0) {
        console.log("Cleaning up test data...");
        await supabase.from('delivery_rates').delete().eq('id', data[0].id);
    }
}

run();
