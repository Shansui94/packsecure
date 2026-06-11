import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    let output = "";
    const log = (msg) => {
        output += msg + "\n";
        console.log(msg);
    };

    const uuids = [
        '8f84abd9-e438-4e4c-9b07-d057c8d530bd',
        'ea29ce6f-df32-4596-9794-2a5d2232e895',
        '447c45b4-71c6-49a9-9509-9e933257144b',
        '8ac2b255-5681-4ce9-a892-143c427781de' // Than Soe
    ];

    log("Resolving operator details for UUIDs...");
    for (const uuid of uuids) {
        log(`\n--- UUID: ${uuid} ---`);
        
        // Check sys_users_v2
        const { data: v2 } = await supabaseAdmin
            .from('sys_users_v2')
            .select('name, employee_id, role')
            .eq('auth_user_id', uuid)
            .maybeSingle();
            
        // Check users_public
        const { data: pub } = await supabaseAdmin
            .from('users_public')
            .select('name, employee_id, role')
            .eq('id', uuid)
            .maybeSingle();

        log(`sys_users_v2: ${v2 ? JSON.stringify(v2) : 'Not found'}`);
        log(`users_public: ${pub ? JSON.stringify(pub) : 'Not found'}`);
    }

    fs.writeFileSync('query_output.txt', output);
    log("\nDone!");
}
run();
