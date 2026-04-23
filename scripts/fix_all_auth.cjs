require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY; 

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAll() {
  const oldSku = 'DL-HITAM-FULL';
  const victimSku = 'BW-DL-BLK-100Mx100CMx1ROLL-GRN';
  const survivorSku = 'BW-DL-BLK-100Mx100CMx1ROLL-RED';

  // Migrate ALL remaining things with Service Role Key
  const r1 = await supabase.from('production_logs_v2').update({ sku: survivorSku }).eq('sku', oldSku).select('log_id');
  console.log('Logs old:', r1.data?.length);

  const r2 = await supabase.from('production_logs_v2').update({ sku: survivorSku }).eq('sku', victimSku).select('log_id');
  console.log('Logs vic:', r2.data?.length);

  const r3 = await supabase.from('production_schedule').update({ sku: survivorSku }).eq('sku', oldSku).select('id');
  console.log('Sched old:', r3.data?.length);

  const r4 = await supabase.from('production_schedule').update({ sku: survivorSku }).eq('sku', victimSku).select('id');
  console.log('Sched vic:', r4.data?.length);
  
}
fixAll();
