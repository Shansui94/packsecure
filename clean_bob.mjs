import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function cleanBob() {
    const { data: users, error } = await s
        .from('sys_users_v2')
        .select('*')
        .ilike('name', '%bob%');

    if (users && users.length > 1) {
        // Find the bad one (the one without an auth_user_id or valid pin)
        // From inspection, one has no auth_user_id or is a legacy test record
        const badBobs = users.filter(u => !u.auth_user_id || !u.pin_code || u.status !== 'Active');
        if (badBobs.length > 0) {
            console.log("Deleting bad Bobs:", badBobs.map(b => b.id));
            for (const b of badBobs) {
                await s.from('sys_users_v2').delete().eq('id', b.id);
            }
            console.log("Deleted");
        } else {
            console.log("All Bobs look valid, need manual cleanup.");
        }
    }
}

cleanBob();
