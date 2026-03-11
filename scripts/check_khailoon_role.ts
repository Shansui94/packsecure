import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const { data: authUser, error: e1 } = await sb.auth.admin.getUserByEmail('khailoon94@gmail.com');
console.log('Auth user ID:', authUser?.user?.id);

if (authUser?.user?.id) {
    const { data: pub } = await sb.from('users_public').select('*').eq('id', authUser.user.id).single();
    console.log('users_public:', JSON.stringify(pub));

    // Also check sys_users_v2
    const { data: sys } = await sb.from('sys_users_v2').select('*').eq('auth_user_id', authUser.user.id).single();
    console.log('sys_users_v2:', JSON.stringify(sys));
}
