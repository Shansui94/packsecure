import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceKeyMatch = envFile.match(/.*SERVICE.*KEY=(.*)/);
const supabaseKey = serviceKeyMatch ? serviceKeyMatch[1].trim() : envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTriggers() {
    console.log('=== Inspecting triggers on sales_orders ===');
    
    // We can query pg_trigger / pg_proc using an RPC or test an update on a dummy order to catch the exact SQL error
    const dummyId = '5919d710-e6a8-4877-88b3-efdabb5a9aa4'; // DO-SHAH-260730-001
    
    console.log('Testing update on DO-SHAH-260730-001 to status Loaded...');
    const { data, error } = await supabase
        .from('sales_orders')
        .update({ status: 'Loaded' })
        .eq('id', dummyId)
        .select();

    console.log('Update result:', data, error);
}

inspectTriggers();
