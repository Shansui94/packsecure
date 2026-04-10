import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    console.log("=== Checking sys_locations_v2 ===");
    const { data: v2, error: errV2 } = await supabase.from('sys_locations_v2').select('*');
    if (errV2) console.error("Error v2:", errV2);
    else console.log(JSON.stringify(v2, null, 2));

    console.log("\n=== Checking sys_locations ===");
    const { data: v1, error: errV1 } = await supabase.from('sys_locations').select('*');
    if (errV1) console.error("Error v1:", errV1);
    else console.log(JSON.stringify(v1, null, 2));
}

run();
