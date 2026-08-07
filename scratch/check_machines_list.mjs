import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env', 'utf-8');
const url = envText.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function main() {
  const { data: mr } = await supabase.from('machine_rates').select('*');
  console.log('machine_rates records:', mr);

  const { data: att } = await supabase.from('operator_attendance').select('machine_id').not('machine_id', 'is', null);
  const uniqueMachines = Array.from(new Set(att?.map(a => a.machine_id)));
  console.log('Unique machines in attendance:', uniqueMachines);
}
main();
