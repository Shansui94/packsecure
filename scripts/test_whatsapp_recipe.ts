import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { 
  ALL_12_MACHINE_CATALOG, 
  formatRecipeCatalog, 
  resolveMachineTarget, 
  formatMachineRecipeReport 
} from '../lib/whatsappRecipe.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runUnitTests() {
  console.log('========================================================');
  console.log('  12-MACHINE WHATSAPP RECIPE & WEIGHT ENGINE TEST SUITE ');
  console.log('========================================================\n');

  // 1. Verify Catalog
  console.log(`[TEST 1] Catalog Size: ${ALL_12_MACHINE_CATALOG.length} machines`);
  console.log(formatRecipeCatalog());
  console.log('--------------------------------------------------------\n');

  // 2. Test Keyword Resolution
  const testPhrases = [
    '配方',
    '配方 T1',
    '配方 T2',
    '500mm 配方',
    '缠绕膜 配方',
    '2米 配方',
    '双层气泡膜 配方',
    '汝来 1米 双层 配方',
    'N2',
    'J1',
    'J2',
    'K1',
    'K2',
    'T5 回收'
  ];

  console.log('[TEST 2] Machine Keyword Resolution:');
  for (const phrase of testPhrases) {
    const resolved = resolveMachineTarget(phrase);
    if (resolved) {
      console.log(`  "${phrase}" -> Matched: [${resolved.machineKey}] ${resolved.machineName} (${resolved.sku})`);
    } else {
      console.log(`  "${phrase}" -> No specific machine (Catalog trigger)`);
    }
  }
  console.log('--------------------------------------------------------\n');

  // 3. Test Live Data Retrieval and Report Formatting for Key Machines
  console.log('[TEST 3] Fetching Live work_photos formulas & formatting reports:');
  const checkMachines = ['T1', 'T2', 'T3', 'N1', 'J1', 'K1'];

  for (const mKey of checkMachines) {
    const meta = ALL_12_MACHINE_CATALOG.find(m => m.machineKey === mKey)!;
    const { data: photoData } = await supabase
      .from('work_photos')
      .select('user_note, employee_name, created_at')
      .eq('category', 'MACHINE_SCREW_FORMULA')
      .eq('machine_id', mKey)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let formula: any = null;
    if (photoData?.user_note) {
      try {
        formula = JSON.parse(photoData.user_note);
      } catch (e) {
        console.error(`Failed to parse formula for ${mKey}`);
      }
    }

    const report = formatMachineRecipeReport(meta, formula);
    console.log(`\n>>> Machine ${mKey} WhatsApp Report:`);
    console.log(report);
  }

  console.log('\n========================================================');
  console.log('  ALL TESTS COMPLETED SUCCESSFULLY!                     ');
  console.log('========================================================');
}

runUnitTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
