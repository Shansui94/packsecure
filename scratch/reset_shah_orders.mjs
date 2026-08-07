import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceKeyMatch = envFile.match(/.*SERVICE.*KEY=(.*)/);
const supabaseKey = serviceKeyMatch ? serviceKeyMatch[1].trim() : envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function resetOrders() {
    console.log('=== Setting SHAH orders to In-Transit ===');
    const { data, error } = await supabase
        .from('sales_orders')
        .update({ status: 'In-Transit' })
        .in('order_number', ['DO-SHAH-260730-001', 'DO-SHAH-260730-002'])
        .select();

    console.log('Reset orders result:', data, error);
}

resetOrders();
