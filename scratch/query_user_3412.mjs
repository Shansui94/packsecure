import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("=== Querying user with PIN/ID 3412 ===");
    
    // Check sys_users_v2
    const { data: v2Data, error: v2Error } = await s
        .from('sys_users_v2')
        .select('*')
        .or('employee_id.eq.3412,pin_code.eq.3412');
        
    console.log("sys_users_v2 result:", v2Data || v2Error);

    // Check users_public
    const { data: pubData, error: pubError } = await s
        .from('users_public')
        .select('*')
        .or('employee_id.eq.3412,email.ilike.%3412%');
        
    console.log("users_public result:", pubData || pubError);
}

run();
