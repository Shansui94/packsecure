import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: perms, error } = await supabase
        .from('role_permissions')
        .select('*');
    if (error) {
        console.error("Error fetching permissions:", error);
    } else {
        console.log("=== ROLE PERMISSIONS ===");
        perms.forEach(p => {
            if (p.role_name === 'SuperAdmin' || p.role_name === 'Admin') {
                console.log(`Role: ${p.role_name} | Page: ${p.page_id} | Allowed: ${p.allowed}`);
            }
        });
    }
}

check();
