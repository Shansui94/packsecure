require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: allLegders } = await supabase.from('stock_ledger_v2').select('sku, type, quantity').ilike('sku', '%HITAM%');
  console.log('Ledger entries for HITAM:', allLegders);
  
  const { data: allLegders3 } = await supabase.from('stock_ledger_v2').select('sku, type, quantity').eq('sku', 'BW-DL-BLK-100Mx100CMx1ROLL-RED');
  console.log('Ledger explicitly RED:', allLegders3);
  
  const { data: bws } = await supabase.from('stock_ledger_v2').select('sku, type, quantity').ilike('sku', '%BW-DL-BLK-100Mx100%');
  console.log('Ledger for BW:', bws);
}
check();
