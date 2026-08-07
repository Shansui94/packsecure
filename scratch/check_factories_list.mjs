import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env', 'utf-8');
const url = envText.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function main() {
  const { data: machines } = await supabase.from('sys_machines_v2').select('factory_id').not('factory_id', 'is', null);
  const factories = Array.from(new Set(machines?.map(m => m.factory_id)));
  console.log('Factories in sys_machines_v2:', factories);

  const { data: users } = await supabase.from('sys_users_v2').select('factory_id').not('factory_id', 'is', null);
  const userFactories = Array.from(new Set(users?.map(u => u.factory_id)));
  console.log('Factories in sys_users_v2:', userFactories);
}

main();
