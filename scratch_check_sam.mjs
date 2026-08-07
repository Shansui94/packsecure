import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data: users, error } = await supabase
    .from('users_public')
    .select('*')
    .ilike('name', '%sam%');

  console.log("=== Users matching 'sam' ===");
  console.log(users, error);
}

run();
