import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data } = await supabase
    .from('production_logs_v2')
    .select('created_at, operator_name, operator_id, machine_id, note')
    .is('operator_id', null)
    .order('created_at', { ascending: false })
    .limit(10);
  if (data) fs.writeFileSync('db_output_ops.json', JSON.stringify(data, null, 2));
}
run();
