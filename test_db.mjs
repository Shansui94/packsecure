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
  const { data, error } = await supabase
    .from('production_logs_v2')
    .select('created_at, machine_id, job_id, sku, note')
    .order('created_at', { ascending: true })
    .limit(10);
    
  if (data) fs.writeFileSync('db_output.json', JSON.stringify(data, null, 2));
}
run();
