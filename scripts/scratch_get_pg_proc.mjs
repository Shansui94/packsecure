import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const { data, error } = await supabase.rpc('exec_sql', {
        sql: `SELECT p.proname, p.prosrc FROM pg_trigger t
              JOIN pg_proc p ON p.oid = t.tgfoid
              WHERE t.tgrelid = 'public.sales_orders'::regclass;`
    });

    if (error) {
        console.log("Error querying triggers:", error);
    } else {
        for (const row of data) {
            console.log(`\n\n--- TRIGGER FUNCTION: ${row.proname} ---`);
            console.log(row.prosrc);
        }
    }
}

run();
