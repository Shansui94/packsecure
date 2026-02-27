import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkLocations() {
    const { data, error } = await supabaseAdmin
        .from('sys_locations_v2')
        .select('*');

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Found locations:", data);
    }
}

checkLocations();
