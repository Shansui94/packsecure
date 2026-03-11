const dotenv = require('dotenv');
dotenv.config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
    const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Get auth user
    const { data: authData } = await sb.auth.admin.getUserByEmail('khailoon94@gmail.com');
    const uid = authData?.user?.id;
    console.log('Auth UID:', uid);

    if (!uid) { console.log('User not found in auth'); return; }

    // Check users_public
    const { data: pub, error: e1 } = await sb.from('users_public').select('*').eq('id', uid).single();
    console.log('users_public result:', JSON.stringify(pub), 'error:', e1?.message);

    // Check sys_users_v2
    const { data: sys, error: e2 } = await sb.from('sys_users_v2').select('id,name,role,email,auth_user_id,employee_id').eq('auth_user_id', uid).single();
    console.log('sys_users_v2 result:', JSON.stringify(sys), 'error:', e2?.message);
}

main().catch(console.error);
