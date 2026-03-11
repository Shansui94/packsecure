import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspect() {
    const { data: leaves } = await s.from('employee_leave').select('*').order('created_at', { ascending: false }).limit(20);
    console.log("Current leaves in DB:", leaves);

    // Find leaves where the mapped user still shows as khailoon94, or we need to find what IDs are still pending/approved
    if (leaves) {
        const ids = leaves.map(l => l.employee_id);
        const { data: users } = await s.from('sys_users_v2').select('auth_user_id, name').in('auth_user_id', ids);
        console.log("Matched Users from sys_users_v2:", users);

        // Let's delete ALL pending/approved leaves just to clear it for the test if it's recent
        const { error: delErr } = await s.from('employee_leave').delete().in('employee_id', ids.filter((id, i) => ids.indexOf(id) === i && users?.some(u => u.auth_user_id === id && u.name === 'khailoon94')));
        if (delErr) console.error("Del Error:", delErr);
        else console.log("Deleted any left over khailoon94 leaves.");
    }
}
inspect();
