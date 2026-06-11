import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    const email = 'emp_1311@packsecure.local';
    const password = '131100';
    console.log(`Attempting login with email: ${email}...`);
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    if (error) {
        console.error("Login failed:", error.message);
    } else {
        console.log("Login success! User:", data.user.id);
    }
}
run();
