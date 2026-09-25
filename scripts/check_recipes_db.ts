import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  const candidateTables = [
    'recipes', 'recipes_v2', 'bom_headers', 'bom_headers_v2',
    'bom_items', 'bom_items_v2', 'machine_recipes', 'product_recipes',
    'production_logs', 'master_items', 'raw_materials', 'work_photos',
    'sys_machines_v2'
  ];

  console.log('Checking candidate tables:');
  for (const t of candidateTables) {
    const { data, error } = await supabase.from(t).select('*').limit(3);
    if (error) {
      console.log(`- ${t}: ❌ Error (${error.message})`);
    } else {
      console.log(`- ${t}: ✅ Exists (${data.length} sample rows)`);
      if (data.length > 0 && (t.includes('recipe') || t.includes('bom'))) {
        console.log(`  Sample:`, JSON.stringify(data[0], null, 2));
      }
    }
  }

  // Check work_photos user_note for any recipe notes
  const { data: wp } = await supabase
    .from('work_photos')
    .select('user_note, employee_name, created_at')
    .ilike('user_note', '%recipe%')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\nRecent work_photos mentioning recipe:', wp);
}

main().catch(console.error);
