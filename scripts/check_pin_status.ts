
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPins() {
    console.log('Checking for users with missing PINs...');

    const { data: users, error } = await supabase
        .from('sys_users_v2')
        .select('id, name, email, role, pin_code')
        .is('pin_code', null);

    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    if (users && users.length > 0) {
        console.log(`Found ${users.length} users with MISSING PINs:`);
        users.forEach(u => {
            console.log(`- [${u.role}] ${u.name} (${u.email || 'No Email'})`);
        });
    } else {
        console.log('✅ All users have PIN codes set.');
    }

    // Also check typical users to see what the PINs are (masked)
    const { data: sample } = await supabase
        .from('sys_users_v2')
        .select('name, pin_code')
        .limit(5);

    if (sample) {
        console.log('\nSample Users:');
        sample.forEach(u => console.log(`${u.name}: ${u.pin_code}`));
    }
}

checkPins();
