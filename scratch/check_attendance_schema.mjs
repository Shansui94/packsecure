import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env', 'utf-8');
const url = envText.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase.from('operator_attendance').select('*').order('created_at', { ascending: false }).limit(10);
  console.log('operator_attendance err:', error);
  console.log('operator_attendance data:', JSON.stringify(data, null, 2));
}
main();
