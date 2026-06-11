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
    .from('salary_advances')
    .update({ status: 'Paid' })
    .eq('id', 'f9b89006-5385-470b-81ba-ae5b76669b15')
    .select();
    
  console.log("Update result:", data, error);
}
run();
