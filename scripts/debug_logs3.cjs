const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient('https://kdahubyhwndgyloaljak.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM');

async function test() {
  const itemResponse = await supabase.from('master_items_v2').select('*').limit(1);
  const triggerItemResponse = await supabase.from('master_items_v2').select('*').eq('product_sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED');

  fs.writeFileSync('scripts/debug_out3.json', JSON.stringify({ itemResponse, triggerItemResponse }, null, 2));
}
test();
