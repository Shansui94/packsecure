const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient('https://kdahubyhwndgyloaljak.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM');

async function check() {
  const { data: active } = await supabase.from('machine_active_products')
     .select('*')
     .eq('machine_id', 'T1.3-M02');
  console.log("Active for T1.3-M02:", active);
}
check();
