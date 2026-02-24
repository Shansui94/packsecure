import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SERVICE_ROLE_KEY!
);

async function restoreNeosonRole() {
    const { error } = await supabase
        .from('users_public')
        .update({ role: 'Manager' })
        .eq('id', '2a5b10bf-3f97-460b-b6f6-fd85c2e191cb');

    if (error) console.error('❌ 失败:', error);
    else console.log('✅ Neoson 角色已改回 Manager（代码层已额外开放 delivery-driver 权限）');
}

restoreNeosonRole().catch(console.error);
