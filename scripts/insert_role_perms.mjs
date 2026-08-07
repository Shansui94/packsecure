import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing Supabase credentials in environment. Check .env file.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const roles = ['Admin', 'Manager', 'LogisticsCoordinator'];
const pages = ['delivery-v2', 'driver-v2'];

async function run() {
    console.log('Using URL:', SUPABASE_URL);
    console.log('Inserting V2 page permissions into role_permissions table...');

    const payloads = [];
    for (const role of roles) {
        for (const page of pages) {
            payloads.push({
                role_name: role,
                page_id: page,
                allowed: true
            });
        }
    }

    const { data, error } = await supabase
        .from('role_permissions')
        .upsert(payloads, { onConflict: 'role_name,page_id' });

    if (error) {
        console.error('❌ Failed to insert permissions:', error.message);
    } else {
        console.log('✅ Permissions successfully deployed to role_permissions!');
    }
}

run();
