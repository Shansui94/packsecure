import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    console.log("=== sys_machines_v2 ===");
    const { data: machines, error: mErr } = await supabase
        .from('sys_machines_v2')
        .select('*');
    if (mErr) console.error("sys_machines_v2 error:", mErr);
    else console.log(machines);

    console.log("\n=== operator_attendance (where clock_out is null) ===");
    const { data: attendance, error: aErr } = await supabase
        .from('operator_attendance')
        .select('*')
        .is('clock_out', null);
    if (aErr) console.error("operator_attendance error:", aErr);
    else console.log(attendance);

    console.log("\n=== All operators active status in sys_users_v2 ===");
    const { data: users, error: uErr } = await supabase
        .from('sys_users_v2')
        .select('employee_id, name, role, status')
        .eq('role', 'Operator');
    if (uErr) console.error("sys_users_v2 error:", uErr);
    else console.log(users);
}
run();
