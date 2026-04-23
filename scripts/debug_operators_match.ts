import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    const ids = [
        '44ae7254-fc00-44f8-88d5-10d364979e43',
        '8f84abd9-e438-4e4c-9b07-d057c8d530bd'
    ];

    const { data: users } = await supabase.from('sys_users_v2').select('id, name').in('id', ids);
    console.log("Matched users in sys_users_v2:", users);
}
main();
