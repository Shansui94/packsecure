import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceKeyMatch = envFile.match(/.*SERVICE.*KEY=(.*)/);
const supabaseKey = serviceKeyMatch ? serviceKeyMatch[1].trim() : envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function deepCheckShah() {
    const shahUid = '8316a554-9710-48f1-8f21-6af57ba0f87f'; // SHAH (singajadian92@gmail.com)

    console.log('=== 1. Checking Lorries table for SHAH ===');
    const { data: lorries, error: lErr } = await supabase
        .from('lorries')
        .select('*')
        .eq('driver_id', shahUid);
    console.log('Lorries bound to SHAH:', lorries, lErr);

    console.log('\n=== 2. Checking all Lorries in Johor / general ===');
    const { data: allLorries } = await supabase.from('lorries').select('*');
    console.log('All lorries:', allLorries);

    console.log('\n=== 3. Checking Sales Orders for SHAH ===');
    const { data: orders } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('driver_id', shahUid);
    console.log('Orders full details:', JSON.stringify(orders, null, 2));

    console.log('\n=== 4. Checking sys_users_v2 for SHAH ===');
    const { data: v2User } = await supabase
        .from('sys_users_v2')
        .select('*')
        .eq('auth_user_id', shahUid);
    console.log('sys_users_v2 entry:', v2User);

    console.log('\n=== 5. Checking users_public for SHAH ===');
    const { data: pubUser } = await supabase
        .from('users_public')
        .select('*')
        .eq('id', shahUid);
    console.log('users_public entry:', pubUser);
}

deepCheckShah();
