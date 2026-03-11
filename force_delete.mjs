import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function clean() {
    const { data: users } = await s.from('sys_users_v2').select('auth_user_id').eq('name', 'khailoon94');
    if (!users || users.length === 0) return console.log('No user khailoon94 found');

    // There could be multiple entries if legacy data exists
    const ids = users.map(u => u.auth_user_id).filter(id => id);
    console.log("Found khailoon94 IDs:", ids);

    for (const uid of ids) {
        const { error } = await s.from('employee_leave').delete().eq('employee_id', uid);
        if (error) console.error("Error deleting for", uid, error);
        else console.log("Deleted leaves for", uid);
    }
}
clean();
