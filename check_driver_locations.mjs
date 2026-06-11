import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const supabase = createClient(url, serviceKey);

  console.log("Fetching drivers and their base locations...");
  const { data: users, error } = await supabase
    .from('users_public')
    .select('id, name, role, base_location')
    .eq('role', 'Driver');

  if (error) {
    console.error("Error fetching drivers:", error);
    return;
  }

  console.log(`Found ${users.length} drivers:`);
  users.forEach(u => {
    console.log(`- Driver: ${u.name} | ID: ${u.id} | Base Location: ${u.base_location}`);
  });
}

run();
