import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env', 'utf-8');
const url = envText.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceKey = envText.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();
const key = serviceKey || envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function main() {
  const { data: mr } = await supabase.from('machine_rates').select('*').limit(1);
  console.log('machine_rates cols:', mr && mr.length > 0 ? Object.keys(mr[0]) : 'empty');

  // Test updating machine_rates with night_rate / day_rate
  const { error: testErr } = await supabase.from('machine_rates').update({ night_rate: 15, day_rate: 10 }).eq('machine_id', 'T1-M03');
  console.log('Update night_rate/day_rate error:', testErr ? testErr.message : 'OK!');

  if (testErr && testErr.message.includes('column')) {
    console.log('Attempting rpc or pg alter...');
    const { error: rpcErr } = await supabase.rpc('exec_sql', {
      query: `
        ALTER TABLE machine_rates ADD COLUMN IF NOT EXISTS night_rate NUMERIC(10,2) DEFAULT 0;
        ALTER TABLE machine_rates ADD COLUMN IF NOT EXISTS day_rate NUMERIC(10,2) DEFAULT 0;
        ALTER TABLE sys_users_v2 ADD COLUMN IF NOT EXISTS factory_login_mode TEXT DEFAULT 'mode_1';
      `
    });
    console.log('RPC exec_sql result:', rpcErr ? rpcErr.message : 'SUCCESS!');
  }
}
main();
