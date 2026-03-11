import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data: users, error } = await s.from('sys_users_v2').select('id, name, employee_id, pin_code, role');
    if (error) { console.error(error); return; }
    const users1234 = users.filter(u => u.employee_id === '1234' || u.pin_code === '1234');
    console.log(`There are ${users1234.length} users with '1234'`);
    console.log(users1234.slice(0, 5));
}
check();
