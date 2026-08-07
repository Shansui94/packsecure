import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    const { data, error } = await supabase
        .from('sys_users_v2')
        .select('employee_id, name, status')
        .eq('status', 'active');

    if (error) {
        console.error(error);
        return;
    }

    console.log("Users still having lowercase 'active' status:", data);
}
run();
