import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Must use SERVICE ROLE KEY for admin operations
const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

const TARGET_EMAIL = 'neosonchun@gmail.com';
const NEW_PASSWORD = '713500';

async function resetPassword() {
    console.log(`Looking up auth user: ${TARGET_EMAIL}...`);

    // List all users and find by email
    const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) { console.error('List error:', listErr); return; }

    const user = users.find(u => u.email?.toLowerCase() === TARGET_EMAIL.toLowerCase());
    if (!user) {
        console.error(`❌ User ${TARGET_EMAIL} not found in auth.users`);
        console.log('All emails:', users.map(u => u.email).join(', '));
        return;
    }

    console.log(`Found user: ${user.id} (${user.email})`);

    // Update password
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
        password: NEW_PASSWORD,
    });

    if (error) {
        console.error('❌ Password reset failed:', error.message);
    } else {
        console.log(`✅ Password reset successful for ${data.user.email}`);
        console.log(`   New password: ${NEW_PASSWORD}`);
    }
}

resetPassword().catch(console.error);
