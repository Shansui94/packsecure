
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkAlif() {
    console.log('--- Checking User Alif ---');

    const { data: users, error } = await supabase
        .from('sys_users_v2')
        .select('*')
        .ilike('email', '%alif%');

    if (error) console.error(error);
    else {
        users.forEach(u => console.log(JSON.stringify(u, null, 2)));
    }
}

checkAlif();
