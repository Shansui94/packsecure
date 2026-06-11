import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const anonClient = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

const serviceClient = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const email = 'hlan.3412@packsecure.com';
    const pin = '3412';
    const password = `${pin}00`;

    console.log(`=== Testing Login with email: ${email}, password: ${password} ===`);
    const { data: loginData, error: loginError } = await anonClient.auth.signInWithPassword({
        email,
        password
    });

    if (loginError) {
        console.error("Login failed:", loginError.message);
        
        console.log("\n=== Checking Supabase Auth via Admin API ===");
        // Try to find the auth user by email
        const { data: usersData, error: listError } = await serviceClient.auth.admin.listUsers();
        if (listError) {
            console.error("Error listing users:", listError.message);
            return;
        }

        const authUser = usersData.users.find(u => u.email === email);
        if (authUser) {
            console.log("Found auth user:", {
                id: authUser.id,
                email: authUser.email,
                created_at: authUser.created_at,
                last_sign_in_at: authUser.last_sign_in_at,
                email_confirmed_at: authUser.email_confirmed_at,
                user_metadata: authUser.user_metadata
            });
        } else {
            console.log(`No auth user found with email ${email}`);
            
            // Check if there's any user with similar email or metadata
            const anyMatch = usersData.users.filter(u => u.email && u.email.includes('3412'));
            console.log("Auth users containing '3412' in email:", anyMatch.map(u => ({ id: u.id, email: u.email })));
        }
    } else {
        console.log("Login success! User ID:", loginData.user.id);
        console.log("Metadata:", loginData.user.user_metadata);
    }
}

run();
