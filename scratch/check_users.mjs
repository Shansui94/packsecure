import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    console.log("Checking sys_users_v2 records for Yan Naing and NAINE...");
    const { data: users, error } = await supabase
        .from('sys_users_v2')
        .select('id, auth_user_id, employee_id, name, email, role');
        
    if (error) {
        console.error("Error:", error);
        return;
    }

    const filtered = users.filter(u => 
        (u.name && u.name.toLowerCase().includes('naine')) || 
        (u.name && u.name.toLowerCase().includes('naing')) ||
        (u.email && u.email.toLowerCase().includes('naing')) ||
        u.employee_id === '8951' ||
        u.employee_id === '6264'
    );
    
    console.log("Matched Users:");
    console.log(JSON.stringify(filtered, null, 2));
}

run();
