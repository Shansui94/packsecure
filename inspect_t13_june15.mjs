import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
    console.log("=== Querying operator_attendance for T1.3-M02 on 2026-06-15 ===");
    const { data: att, error } = await supabase
        .from('operator_attendance')
        .select('*')
        .eq('machine_id', 'T1.3-M02')
        .eq('date', '2026-06-15')
        .order('clock_in', { ascending: true });
    
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Attendance records:");
        console.table(att);
    }
}

run();
