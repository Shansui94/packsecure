import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
    const { data: s } = await supabase.from('sys_users_v2').select('email, role').eq('employee_id', '1224').single();
    if (!s) return console.log("Not found in sys");
    const { data: p } = await supabase.from('users_public').select('role, status').eq('email', s.email).single();
    console.log(`1224: Email=${s.email}, sys_role=${s.role}, pub_role=${p?.role}, status=${p?.status}`);
    
    if (p?.role) {
        const { data: perms } = await supabase.from('role_permissions').select('page_id').eq('role_name', p.role).eq('allowed', true);
        console.log(`Allowed permissions for ${p.role}:`, perms?.map(x => x.page_id).join(', '));
    }
}

check();
