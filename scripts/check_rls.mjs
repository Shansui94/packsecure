import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceKeyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const key = serviceKeyMatch[1].trim();
const supabase = createClient(supabaseUrl, key);

async function checkRLS() {
    const { data, error } = await supabase.rpc('execute_sql', {
        query: `SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'stock_ledger_v2';`
    });
    console.log(data || error);
}
checkRLS();
