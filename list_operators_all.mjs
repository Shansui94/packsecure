import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    console.log("Fetching operators from sys_users_v2...");
    const { data: operators, error } = await supabaseAdmin
        .from('sys_users_v2')
        .select('*');

    if (error) {
        console.error("Error fetching operators:", error);
    } else {
        console.log("All Operators:");
        console.table(operators.map(o => ({
            id: o.id,
            employee_id: o.employee_id,
            name: o.name,
            role: o.role,
            factory_id: o.factory_id
        })));
    }
}
run();
