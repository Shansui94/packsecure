import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("=== Testing case-sensitive status query ===");
    
    // Case 1: status = 'Active' (as queried in ProductionControl)
    const { data: d1, error: e1 } = await s
        .from('sys_users_v2')
        .select('id, name, employee_id, status')
        .eq('employee_id', '3412')
        .eq('status', 'Active');
    console.log("Query with status = 'Active':", d1, e1 ? e1.message : "");

    // Case 2: status = 'active'
    const { data: d2, error: e2 } = await s
        .from('sys_users_v2')
        .select('id, name, employee_id, status')
        .eq('employee_id', '3412')
        .eq('status', 'active');
    console.log("Query with status = 'active':", d2, e2 ? e2.message : "");
}

run();
