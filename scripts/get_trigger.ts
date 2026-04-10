import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    const { data: trigger, error } = await supabase.rpc('query_sql', {
        query: `
            SELECT prosrc 
            FROM pg_proc 
            WHERE proname = 'distribute_production_to_ledger'
        `
    });
    
    // Fallback if query_sql is not defined:
    if (error) {
        console.log("Error querying directly:", error.message);
    } else {
        console.log(trigger);
    }
}
check().catch(console.error);
