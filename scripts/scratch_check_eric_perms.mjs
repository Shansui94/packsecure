import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const { data: userV2 } = await supabase.from('sys_users_v2').select('*').eq('email', 'ericsoobaolin0219@gmail.com');
    console.log("Eric's Data:", JSON.stringify(userV2, null, 2));

    const { data: modules } = await supabase.from('sys_user_modules').select('*').eq('user_id', userV2[0].id);
    console.log("Eric's custom modules:", JSON.stringify(modules, null, 2));
}
run();
