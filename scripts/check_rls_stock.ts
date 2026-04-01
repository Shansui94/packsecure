import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkRLS() {
    const { data, error } = await supabase.rpc('get_policies', { table_name: 'stock_ledger_v2' });
    if (error) {
        console.error('RPC Error:', error.message);
        // Fallback: try direct query if we have admin rights, wait, we are using anon key, so we can't query pg_policies easily unless there is an RPC.
    } else {
        console.log(data);
    }
}

checkRLS();
