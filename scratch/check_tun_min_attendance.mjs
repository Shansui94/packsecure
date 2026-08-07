import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    console.log("Fetching detailed attendance records for N2-M02 in June 2026...");
    const { data, error } = await supabase
        .from('operator_attendance')
        .select('id, operator_id, clock_in, clock_out, hours_worked, notes')
        .eq('machine_id', 'N2-M02')
        .gte('clock_in', '2026-06-01T00:00:00Z')
        .lt('clock_in', '2026-07-01T00:00:00Z')
        .order('clock_in', { ascending: true });
        
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    } else {
        console.error(error);
    }
}

run();
