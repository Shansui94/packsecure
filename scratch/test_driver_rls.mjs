import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const anonKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const serviceKey = envFile.match(/.*SERVICE.*KEY=(.*)/)?.[1]?.trim() || anonKey;

const adminSupabase = createClient(supabaseUrl, serviceKey);

async function checkDriverPermissions() {
    console.log('=== Checking SHAH User Profile & RLS permissions ===');

    const shahUid = '8316a554-9710-48f1-8f21-6af57ba0f87f';
    
    // Check sys_users_v2
    const { data: v2User } = await adminSupabase
        .from('sys_users_v2')
        .select('*')
        .eq('auth_user_id', shahUid)
        .single();
    
    console.log('SHAH sys_users_v2:', v2User);

    // Check users_public
    const { data: pubUser } = await adminSupabase
        .from('users_public')
        .select('*')
        .eq('id', shahUid)
        .single();
    
    console.log('SHAH users_public:', pubUser);

    // Check lorries table
    const { data: lorries } = await adminSupabase
        .from('lorries')
        .select('*')
        .eq('driver_id', shahUid);
    
    console.log('SHAH lorries:', lorries);

    // Check RLS policies on sales_orders table
    const { data: policies, error: pErr } = await adminSupabase
        .rpc('inspect_policies', { table_name: 'sales_orders' })
        .catch(() => ({ data: null }));

    console.log('sales_orders RLS policies check (if rpc exists):', policies);
}

checkDriverPermissions();
