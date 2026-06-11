import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    const { data: users, error } = await supabase
        .from('sys_users_v2')
        .select('email, role, employee_id')
        .eq('role', 'SuperAdmin')
        .limit(5);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("SuperAdmins found:", users);
    }
}
run();
