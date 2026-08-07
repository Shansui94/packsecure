import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  console.log("Checking role_permissions for Driver...");
  const { data: perms, error: err } = await supabase
    .from('role_permissions')
    .select('*')
    .eq('role_name', 'Driver');
    
  if (err) {
    console.error("Error fetching permissions:", err);
  } else {
    console.log("Permissions for Driver:");
    console.log(perms.map(p => ({ page_id: p.page_id, allowed: p.allowed })));
  }

  console.log("\nChecking active page usage in role_permissions...");
  const { data: allPerms, error: errAll } = await supabase
    .from('role_permissions')
    .select('*')
    .in('page_id', ['delivery-driver', 'driver-v2'])
    .eq('allowed', true);

  if (errAll) {
    console.error("Error fetching all permissions:", errAll);
  } else {
    console.log("Who is allowed to access delivery-driver or driver-v2:");
    console.log(allPerms.map(p => ({ role: p.role_name, page_id: p.page_id })));
  }
}
run();
