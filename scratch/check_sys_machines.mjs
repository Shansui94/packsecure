import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env', 'utf-8');
const url = envText.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function main() {
  const { data: machines, error } = await supabase.from('sys_machines_v2').select('*');
  console.log('sys_machines_v2 err:', error);
  console.log('sys_machines_v2 count:', machines?.length);
  console.log('sys_machines_v2 sample:', JSON.stringify(machines, null, 2));

  const { data: mRates } = await supabase.from('machine_rates').select('*');
  console.log('machine_rates:', mRates);
}
main();
