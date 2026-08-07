import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    console.log("=== Checking operator 3412 details ===");
    const { data, error } = await supabase
        .from('sys_users_v2')
        .select('employee_id, name, role, status, pin_code, auth_user_id')
        .eq('employee_id', '3412')
        .maybeSingle();

    if (error) console.error(error);
    else console.log(data);
}
run();
