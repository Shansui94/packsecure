import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const { data: pubUsers } = await supabase.from('users_public').select('*');
    const { data: v2Users } = await supabase.from('sys_users_v2').select('*');

    const v2AuthIds = new Set(v2Users.filter(u => u.auth_user_id).map(u => u.auth_user_id));
    const stranded = pubUsers.filter(u => !v2AuthIds.has(u.id));

    console.log(`Found ${stranded.length} stranded users:`);
    console.log(stranded.map(u => u.email));
}
run();
