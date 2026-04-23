import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const { data, error } = await supabase.rpc('exec_sql', {
        sql: `SELECT pol.polname, pol.polcmd, pol.polroles, pol.polqual, pol.polwithcheck 
              FROM pg_policy pol
              JOIN pg_class c ON c.oid = pol.polrelid
              WHERE c.relname = 'delivery_rates'`
    });

    if (error) {
        console.log("No exec_sql, getting from schema table...", error.message);
        // Fallback: check triggers or just try an insert as authenticated user
    } else {
        console.log("Policies:", data);
    }
}
run();
