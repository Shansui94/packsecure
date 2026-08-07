import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceKeyMatch = envFile.match(/.*SERVICE.*KEY=(.*)/);
const supabaseKey = serviceKeyMatch ? serviceKeyMatch[1].trim() : envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixShah() {
    const shahUid = '8316a554-9710-48f1-8f21-6af57ba0f87f';
    console.log('=== Fixing Driver SHAH Profile & Orders ===');

    // 1. Fix sys_users_v2
    const { data: v2Data, error: v2Err } = await supabase
        .from('sys_users_v2')
        .update({
            role_modules: ['work-photos', 'delivery-driver', 'delivery-history', 'leave-calendar', 'lorry-service'],
            factory_id: 'J1'
        })
        .eq('auth_user_id', shahUid)
        .select();
    console.log('Updated sys_users_v2:', v2Data, v2Err);

    // 2. Fix users_public
    const { data: pubData, error: pubErr } = await supabase
        .from('users_public')
        .update({
            factory_id: 'J1',
            base_location: 'Johor'
        })
        .eq('id', shahUid)
        .select();
    console.log('Updated users_public:', pubData, pubErr);

    // 3. Fix Sales Orders status to 'In-Transit' for SHAH
    const { data: orderData, error: orderErr } = await supabase
        .from('sales_orders')
        .update({
            status: 'In-Transit'
        })
        .eq('driver_id', shahUid)
        .eq('status', 'New')
        .select();
    console.log('Updated sales_orders status to In-Transit:', orderData, orderErr);
}

fixShah();
