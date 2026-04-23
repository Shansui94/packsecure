require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Use service role key to bypass RLS
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY; 

const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
  console.log("Using key starting with:", supabaseKey.substring(0, 15) + '...');
  
  // Actually perform the update directly here with service role to bypass RLS!
  const oldSku = 'DL-HITAM-FULL';
  const victimSku = 'BW-DL-BLK-100Mx100CMx1ROLL-GRN';
  const survivorSku = 'BW-DL-BLK-100Mx100CMx1ROLL-RED';

  const res1 = await supabase.from('stock_ledger_v2').update({ sku: survivorSku }).eq('sku', oldSku).select('txn_id');
  console.log('Update oldSku ledger:', res1.data, res1.error);
  
  const res2 = await supabase.from('stock_ledger_v2').update({ sku: survivorSku }).eq('sku', victimSku).select('txn_id');
  console.log('Update victimSku ledger:', res2.data, res2.error);

  const res3 = await supabase.from('stock_ledger_v2').select('sku, type, quantity').ilike('sku', '%DL-HITAM%');
  console.log('Final check for DL-HITAM:', res3.data);
  const res4 = await supabase.from('stock_ledger_v2').select('sku, type, quantity').eq('sku', survivorSku);
  console.log('Final check for RED:', res4.data);
}
fix();
