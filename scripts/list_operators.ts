import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SERVICE_ROLE_KEY!
);

async function listAll() {
    const { data, error } = await supabase
        .from('sys_users_v2')
        .select('employee_id, name, role, status')
        .order('employee_id');

    if (error) { console.error(error.message); return; }

    console.log('\n全部用户（按员工号排序）:\n');
    console.table((data || []).map((u: any) => ({
        员工号: u.employee_id || '—',
        姓名: u.name || '—',
        角色: u.role,
        状态: u.status,
    })));
}

listAll();
