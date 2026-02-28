import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

async function tryTable(name, select = '*') {
    const { data, error } = await supabase.from(name).select(select).limit(2);
    if (error) return `❌ ${error.message}`;
    if (!data || data.length === 0) return `✅ exists but empty`;
    return `✅ columns: ${Object.keys(data[0]).join(', ')}`;
}

async function run() {
    const tables = [
        'operator_attendance', 'operator_sessions', 'clock_records',
        'attendance_logs', 'shift_logs', 'work_sessions',
        'delivery_orders_v2', 'trips', 'trip_allowances', 'driver_trips',
        'payroll_records', 'employee_leave',
        'role_permissions', 'page_permissions',
    ];

    console.log('=== TABLE DISCOVERY ===');
    for (const t of tables) {
        const result = await tryTable(t);
        console.log(`  ${t}: ${result}`);
    }

    // Also check delivery_orders more carefully
    const { data: doData } = await supabase.from('delivery_orders').select('driver_id, allowance, total_allowance, trip_fee').limit(3);
    console.log('\n=== delivery_orders sample ===', JSON.stringify(doData));

    // Check users for any existing data about roles
    const { data: users } = await supabase.from('sys_users_v2').select('role, department').limit(20);
    const roles = [...new Set((users || []).map(u => u.role))];
    const depts = [...new Set((users || []).map(u => u.department))];
    console.log('\n=== Distinct roles ===', roles);
    console.log('=== Distinct departments ===', depts);
}

run();
