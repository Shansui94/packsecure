import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const { data: perms, error } = await supabase.from('role_permissions').select('*');
    if (error) {
        console.error("Error fetching permissions:", error);
    } else {
        console.log(`Found ${perms?.length || 0} permission rows in DB.`);
        const counts = {};
        (perms || []).forEach(p => {
            counts[p.role_name] = (counts[p.role_name] || 0) + 1;
        });
        console.log("Count per role:", counts);
        
        // Print Driver perms to see exactly what is there
        const driverPerms = (perms || []).filter(p => p.role_name === 'Driver');
        console.log("Driver perms:", driverPerms);
    }
}
run();
