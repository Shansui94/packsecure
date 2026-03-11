import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function cleanEverything() {
    // 1. Get all leaves
    const { data: leaves } = await s.from('employee_leave').select('*');
    if (!leaves) return;

    // 2. Get all users
    const { data: users } = await s.from('sys_users_v2').select('auth_user_id, name');

    // 3. Find target ids mapped to khailoon94
    const khailoon_ids = (users || []).filter(u => u.name?.toLowerCase().includes('khailoon')).map(u => u.auth_user_id);

    // 4. Also find those where name fails mapping if needed, but let's stick to khailoon
    console.log("Found khailoon_ids:", khailoon_ids);

    const leavesToDelete = leaves.filter(l => khailoon_ids.includes(l.employee_id));
    console.log(`Found ${leavesToDelete.length} leaves to delete.`);

    for (const l of leavesToDelete) {
        await s.from('employee_leave').delete().eq('id', l.id);
        console.log("Deleted leaf:", l.id);
    }
}
cleanEverything();
