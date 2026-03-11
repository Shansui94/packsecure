import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkPins() {
    const { data: users, error } = await s.from('sys_users_v2').select('id, name, employee_id, pin_code, role');
    if (error) { console.error("Error fetching users:", error); return; }

    // Check what the actual employee IDs and PINs are
    const users1234 = users?.filter(u => u.employee_id === '1234' || u.pin_code === '1234');
    console.log(JSON.stringify(users1234, null, 2));
}

checkPins();
