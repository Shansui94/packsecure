import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = './.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('\r').join('').split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function main() {
    const uuids = [
        'f92de2f3-6a6f-4d3b-aa34-437c89c9e81f',
        '19a0093b-bbe0-40c6-9a5e-68cc3ae8f975',
        'cd0ca225-772f-4835-aaea-6aeca45b630d',
        'bfbb461d-d72c-4277-93f7-f7811248d0c6',
        'd15a7cec-bef4-4237-a5c6-d12c06871537'
    ];
    
    console.log("Resolving user details for UUIDs...");
    const { data: users, error } = await supabase.from('sys_users_v2')
        .select('*')
        .in('id', uuids);
        
    if (error) {
        console.error("Error querying by id:", error);
    } else {
        users?.forEach(u => {
            console.log(`- ID: ${u.id} | Employee ID: ${u.employee_id} | Name: ${u.name} | Role: ${u.role}`);
        });
    }
    
    // Also check by auth_user_id
    const { data: usersByAuth, error: errorAuth } = await supabase.from('sys_users_v2')
        .select('*')
        .in('auth_user_id', uuids);
        
    if (errorAuth) {
        console.error("Error querying by auth_user_id:", errorAuth);
    } else {
        usersByAuth?.forEach(u => {
            console.log(`- (By Auth) ID: ${u.id} | Employee ID: ${u.employee_id} | Name: ${u.name} | Role: ${u.role}`);
        });
    }
}

main().catch(console.error);
