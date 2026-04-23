import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    // 1. Fetch user from users_public
    const { data: pubUsers } = await supabase.from('users_public').select('*').eq('email', 'ericsoobaolin0219@gmail.com');
    if (!pubUsers || pubUsers.length === 0) {
        console.log("no eric user found");
        return;
    }
    const eric = pubUsers[0];

    // 2. Insert into v2
    const { data: v2User, error: v2Error } = await supabase.from('sys_users_v2').insert({
        auth_user_id: eric.id,
        employee_id: eric.employee_id,
        name: 'Eric',
        role: eric.role,
        email: eric.email,
        status: eric.status,
        pin_code: eric.employee_id, // Default pin as employee id
        pay_type: 'monthly',
        base_salary: eric.salary
    }).select();

    if (v2Error) {
        console.log("Insert Error:", v2Error);
    } else {
        console.log("Successfully imported Eric to sys_users_v2:", v2User);
    }
}
run();
