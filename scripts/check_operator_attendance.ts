import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
    console.log("=== Inspecting Operators & Operator Attendance ===");

    // 1. Fetch Operators from sys_users_v2
    const { data: operators } = await supabase
        .from('sys_users_v2')
        .select('id, auth_user_id, employee_id, pin_code, name, role, pay_type, hourly_rate, base_salary')
        .eq('role', 'Operator');

    console.log(`\nOperators in sys_users_v2 (${operators?.length || 0}):`);
    operators?.forEach(op => {
        console.log(`  - Name: ${op.name} | ID: ${op.id} | Auth: ${op.auth_user_id} | EmpID: ${op.employee_id} | PIN: ${op.pin_code} | PayType: ${op.pay_type} | HourlyRate: RM${op.hourly_rate} | BaseSalary: RM${op.base_salary}`);
    });

    // 2. Fetch sample operator_attendance records
    const { data: attendance } = await supabase
        .from('operator_attendance')
        .select('*')
        .limit(20);

    console.log(`\nSample operator_attendance records (${attendance?.length || 0}):`);
    attendance?.forEach(att => {
        console.log(`  - operator_id: "${att.operator_id}" | date: ${att.date} | hours_worked: ${att.hours_worked}`);
    });

    console.log("=== Check Complete ===");
}

run();
