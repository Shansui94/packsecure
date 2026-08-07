import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function search() {
    const ayamUuid = 'b8f72c63-e20b-4588-8f82-e1c20ab4b83a';
    const authUuid = 'ffeb9b0a-0d32-41f2-ba81-f2257ba45c17';

    console.log(`=== Querying for driver_id = ${ayamUuid} and auth_user_id = ${authUuid} ===`);

    // 1. Query trips_v2 by driver_id (which is UUID)
    const { data: trips, error: errTrips } = await supabase
        .from('trips_v2')
        .select('*')
        .eq('driver_id', ayamUuid);
    
    console.log(`- trips_v2 count: ${trips?.length || 0}`, errTrips ? `Error: ${errTrips.message}` : '');
    if (trips && trips.length > 0) {
        console.log("Sample trip:", trips[0]);
    }

    // 2. Query delivery_orders_v2 or similar?
    // Let's get one trip to see what fields are in it
    const { data: allTrips, error: errAll } = await supabase
        .from('trips_v2')
        .select('*')
        .limit(3);
    console.log("trips_v2 sample:", allTrips);
}

search();
