import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    console.log("Checking sys_users_v2...");
    const { data: v2Users } = await supabase.from('sys_users_v2').select('*').ilike('email', '%ericsoobaolin0219%');
    console.log("sys_users_v2 matched by email:", v2Users);

    const { data: v2UsersName } = await supabase.from('sys_users_v2').select('*').ilike('name', '%ericsoobaolin0219%');
    console.log("sys_users_v2 matched by name:", v2UsersName);

    console.log("\nChecking users_public...");
    const { data: pubUsers } = await supabase.from('users_public').select('*').ilike('email', '%ericsoobaolin0219%');
    console.log("users_public matched by email:", pubUsers);

    const { data: pubUsersName } = await supabase.from('users_public').select('*').ilike('name', '%ericsoobaolin0219%');
    console.log("users_public matched by name:", pubUsersName);

    // we can also search without wildcard suffix in case it's an exact match somewhere
}
run();
