import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const { data, error } = await s
        .from('sys_users_v2')
        .select('employee_id, name, status, role');
        
    if (error) {
        console.error("Error fetching sys_users_v2:", error.message);
        return;
    }
    
    console.log("=== User Statuses in sys_users_v2 ===");
    console.log(data);
    
    // Check users_public as well
    const { data: pubData, error: pubError } = await s
        .from('users_public')
        .select('employee_id, name, status, role');
        
    if (pubError) {
        console.error("Error fetching users_public:", pubError.message);
        return;
    }
    
    console.log("\n=== User Statuses in users_public ===");
    console.log(pubData);
}

run();
