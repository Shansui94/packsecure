import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    console.log("=== Recent operator_attendance records ===");
    const { data, error } = await supabase
        .from('operator_attendance')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
    if (error) console.error(error);
    else console.log(data);
}
run();
