const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient('https://kdahubyhwndgyloaljak.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM');

async function fix() {
  await supabase.from('master_items_v2').update({ nickname: '1M Single Layer (MERAH)' }).eq('sku', 'BW-SL-CLR-100Mx100CMx1ROLL-RED');
  console.log("Fixed nickname!");
}
fix();
