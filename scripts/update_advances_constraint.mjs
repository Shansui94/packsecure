import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Altering constraints on public.salary_advances...");
  
  // Step 1: Drop old check constraint if it exists
  const dropQuery = `ALTER TABLE public.salary_advances DROP CONSTRAINT IF EXISTS salary_advances_status_check;`;
  const { data: dropRes, error: dropErr } = await supabase.rpc('exec_sql', { sql_query: dropQuery });
  if (dropErr) {
    console.error("Error dropping constraint:", dropErr);
    return;
  }
  console.log("Successfully dropped constraint (if existed).");

  // Step 2: Add new check constraint with 'Paid'
  const addQuery = `ALTER TABLE public.salary_advances ADD CONSTRAINT salary_advances_status_check CHECK (status IN ('Pending', 'Approved', 'Paid', 'Rejected'));`;
  const { data: addRes, error: addErr } = await supabase.rpc('exec_sql', { sql_query: addQuery });
  if (addErr) {
    console.error("Error adding constraint:", addErr);
    return;
  }
  console.log("Successfully added new check constraint including 'Paid' status!");
}

run().catch(err => {
  console.error("Unhandled error:", err);
});
