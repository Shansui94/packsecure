import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceKeyMatch = envFile.match(/.*SERVICE.*KEY=(.*)/);
const supabaseKey = serviceKeyMatch ? serviceKeyMatch[1].trim() : envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectFk() {
    console.log('=== 1. Check valid locations in sys_locations_v2 / locations ===');
    const { data: sysLocs, error: sErr } = await supabase.from('sys_locations_v2').select('*');
    console.log('sys_locations_v2 entries:', sysLocs, sErr);

    const { data: locs, error: lErr } = await supabase.from('locations').select('*');
    console.log('locations entries:', locs, lErr);

    console.log('\n=== 2. Check foreign key definitions for stock_ledger_v2 ===');
    const { data: fkInfo, error: fkErr } = await supabase.rpc('execute_sql', {
        query: `
            SELECT
                tc.constraint_name, 
                kcu.column_name, 
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name 
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='stock_ledger_v2';
        `
    }).catch(e => ({ data: null, error: e }));

    console.log('stock_ledger_v2 FK constraints (via RPC if allowed):', fkInfo, fkErr);

    // Alternative: insert dummy test record with loc_id = 'Johor' or 'JOHOR' or location_id
    console.log('\n=== 3. Check Order DO-SHAH-260730-001 items ===');
    const { data: order } = await supabase.from('sales_orders').select('*').eq('order_number', 'DO-SHAH-260730-001').single();
    console.log('Order DO-SHAH-260730-001:', JSON.stringify(order, null, 2));
}

inspectFk();
