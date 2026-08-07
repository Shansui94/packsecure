import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing environment variables VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Searching for 'ayam' in sys_machines_v2...");
    const { data: machines, error: err1 } = await supabase
        .from('sys_machines_v2')
        .select('*');
    
    if (err1) console.error("Error sys_machines_v2:", err1);
    
    const matchedMachines = machines?.filter(m => 
        JSON.stringify(m).toLowerCase().includes('ayam')
    );
    console.log("Matched machines:", matchedMachines);

    console.log("Searching for 'ayam' in sys_users_v2...");
    const { data: users, error: err2 } = await supabase
        .from('sys_users_v2')
        .select('*');

    if (err2) console.error("Error sys_users_v2:", err2);

    const matchedUsers = users?.filter(u => 
        JSON.stringify(u).toLowerCase().includes('ayam')
    );
    console.log("Matched users:", matchedUsers);

    // Let's also check active/recent jobs or schedules if any
    console.log("Searching for 'ayam' in active jobs/schedules...");
    const { data: jobs, error: err3 } = await supabase
        .from('job_orders')
        .select('*')
        .limit(100);

    if (err3) {
        // Table might not be job_orders, let's try other tables or ignore
        console.log("No job_orders or error:", err3.message);
    } else {
        const matchedJobs = jobs?.filter(j => 
            JSON.stringify(j).toLowerCase().includes('ayam')
        );
        console.log("Matched jobs:", matchedJobs);
    }
}

check();
