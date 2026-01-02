
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Force load .env.local from current working directory
const envPath = path.resolve(process.cwd(), '.env.local');
console.log(`Loading env from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error("Error loading .env.local:", result.error);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase env vars. Keys found:", Object.keys(process.env).filter(k => k.includes('SUPABASE')));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setPins() {
    console.log("Fetching Active Users...");

    // 1. Get Active Users
    const { data: users, error: fetchError } = await supabase
        .from('sys_users_v2')
        .select('id, name')
        .eq('status', 'Active');

    if (fetchError) {
        console.error("Error fetching users:", fetchError);
        return;
    }

    if (!users || users.length === 0) {
        console.log("No active users found.");
        return;
    }

    console.log(`Found ${users.length} active users. updating PINs to '1234'...`);

    // 2. Update PINs
    const { error: updateError } = await supabase
        .from('sys_users_v2')
        .update({ pin_code: '1234' })
        .eq('status', 'Active'); // Bulk update if RLS allows, otherwise loop

    if (updateError) {
        console.error("Bulk update failed (likely RLS). Trying individual updates...");

        for (const user of users) {
            const { error: singleError } = await supabase
                .from('sys_users_v2')
                .update({ pin_code: '1234' })
                .eq('id', user.id);

            if (singleError) console.error(`Failed to update ${user.name}:`, singleError.message);
            else console.log(`✅ Updated PIN for: ${user.name} (${user.email})`);
        }
    } else {
        console.log("✅ Bulk update successful!");
        users.forEach(u => console.log(` - ${u.name}`));
    }
}

setPins();
