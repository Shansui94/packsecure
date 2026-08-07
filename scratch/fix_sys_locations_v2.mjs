import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceKeyMatch = envFile.match(/.*SERVICE.*KEY=(.*)/);
const supabaseKey = serviceKeyMatch ? serviceKeyMatch[1].trim() : envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function addLocations() {
    console.log('=== Adding Johor and Kelantan to sys_locations_v2 ===');
    
    const newLocations = [
        { loc_id: 'Johor', name: 'Johor', type: 'Warehouse', factory_id: 'J1' },
        { loc_id: 'JOHOR', name: 'Johor', type: 'Warehouse', factory_id: 'J1' },
        { loc_id: 'Kelantan', name: 'Kelantan', type: 'Warehouse', factory_id: 'K1' },
        { loc_id: 'KELANTAN', name: 'Kelantan', type: 'Warehouse', factory_id: 'K1' }
    ];

    const { data, error } = await supabase
        .from('sys_locations_v2')
        .upsert(newLocations, { onConflict: 'loc_id' })
        .select();

    console.log('Upsert sys_locations_v2 result:', data, error);

    // Verify updating DO-SHAH-260730-001 now!
    console.log('\nTesting order update on DO-SHAH-260730-001 again...');
    const { data: orderData, error: orderErr } = await supabase
        .from('sales_orders')
        .update({ status: 'Loaded' })
        .eq('order_number', 'DO-SHAH-260730-001')
        .select();

    console.log('Order update result:', orderData, orderErr);
}

addLocations();
