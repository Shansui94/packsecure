import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    console.log("=== Querying Active users exactly like ProductionControl.tsx ===");
    const { data, error } = await supabase
        .from('sys_users_v2')
        .select('auth_user_id, employee_id, name, photo_url, role')
        .eq('status', 'Active')
        .order('name');

    if (error) {
        console.error(error);
        return;
    }

    const filtered = data.filter(u => u.role === 'Operator' || u.role === 'SuperAdmin' || u.role === 'Admin' || u.role === 'Manager');
    console.log(`Found ${filtered.length} active operators/admins.`);
    
    const hlanThan = filtered.find(u => u.employee_id === '3412');
    if (hlanThan) {
        console.log("SUCCESS: 'hlan than' (3412) is in the list:", hlanThan);
    } else {
        console.log("FAILURE: 'hlan than' (3412) is NOT in the list!");
    }
}
run();
