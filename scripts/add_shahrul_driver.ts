import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function addDriver() {
    const driver = { name: 'Shahrul', id: '5563' };
    const password = '9821';

    const cleanName = driver.name.toLowerCase().replace(/\s/g, '');
    const email = `${cleanName}.${driver.id}@packsecure.com`;

    console.log('🚀 Adding driver...');
    console.log(`  Name     : ${driver.name}`);
    console.log(`  ID       : ${driver.id}`);
    console.log(`  Email    : ${email}`);
    console.log(`  Password : ${password}`);

    try {
        // 1. Create Auth User
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: {
                full_name: driver.name,
                employee_id: driver.id
            }
        });

        if (authError) {
            console.error(`❌ Error creating auth user: ${authError.message}`);
            process.exit(1);
        }

        const uid = authData.user.id;
        console.log(`✅ Auth user created. UID: ${uid}`);

        // 2. Upsert public profile
        const { error: dbError } = await supabase.from('users_public').upsert({
            id: uid,
            email: email,
            name: driver.name,
            employee_id: driver.id,
            role: 'Driver',
            status: 'Active'
        });

        if (dbError) {
            console.error(`❌ Error upserting public profile: ${dbError.message}`);
            process.exit(1);
        }

        console.log('✅ Public profile upserted.');
        console.log('');
        console.log('--- DRIVER CREDENTIALS ---');
        console.log(`  Email    : ${email}`);
        console.log(`  Password : ${password}`);
        console.log('--------------------------');
        console.log('✅ Done! Driver Shahrul added successfully.');

    } catch (e: any) {
        console.error('Exception:', e.message);
        process.exit(1);
    }
}

addDriver();
