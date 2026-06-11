import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  console.log("Checking base_location in users_public...");
  const { data: users, error: userError } = await supabase.from('users_public').select('base_location').limit(1);
  if (userError) {
    console.log("Error checking users_public.base_location:", userError.message);
  } else {
    console.log("base_location check: OK", users);
  }

  console.log("Checking machine_rates table...");
  const { data: mr, error: mrError } = await supabase.from('machine_rates').select('*').limit(1);
  if (mrError) {
    console.log("Error checking machine_rates:", mrError.message);
  } else {
    console.log("machine_rates check: OK", mr);
  }

  console.log("Checking payroll_drafts table...");
  const { data: pd, error: pdError } = await supabase.from('payroll_drafts').select('*').limit(1);
  if (pdError) {
    console.log("Error checking payroll_drafts:", pdError.message);
  } else {
    console.log("payroll_drafts check: OK", pd);
  }

  console.log("Checking sales_orders for unassigned RLS...");
  // We can't easily check RLS policy definitions from the data API without raw SQL access, but we checked the tables above.
}

check();
