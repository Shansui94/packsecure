import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    // Check old logs that have operator_id
    const { data: logs } = await supabase.from('production_logs_v2').select('operator_id').not('operator_id', 'is', null).limit(10);
    console.log("Sample old logs operator IDs:", logs);

    // Check what is in sys_users_v2
    const { data: users } = await supabase.from('sys_users_v2').select('id, employee_id, name').limit(5);
    console.log("Sample sys_users_v2:", users);
}
main();
