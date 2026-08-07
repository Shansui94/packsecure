import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    console.log("=== All shifts for operator 3412 (hlan than) ===");
    const { data, error } = await supabase
        .from('operator_attendance')
        .select('*')
        .eq('operator_id', '3412')
        .order('clock_in', { ascending: false });

    if (error) console.error(error);
    else console.log(data);
}
run();
