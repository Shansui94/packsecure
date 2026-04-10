const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient('https://kdahubyhwndgyloaljak.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM');

async function test() {
  const { data: logs } = await supabase.from('production_logs_v2')
     .select('*')
     .order('created_at', { ascending: false })
     .limit(10);
  
  const { data: heartbeats } = await supabase.from('iot_device_configs')
     .select('machine_id, version, status, location_name')
     .order('last_heartbeat', { ascending: false })
     .limit(10);
  
  const { data: active } = await supabase.from('machine_active_products')
     .select('*')
     .like('machine_id', '%T1.3%');
  
  const { data: master } = await supabase.from('master_items_v2')
     .select('product_sku, item_name')
     .like('item_name', '%T1.3%');

  const { data: all_active } = await supabase.from('machine_active_products').select('*');

  fs.writeFileSync('scripts/debug_out.json', JSON.stringify({
    logs, heartbeats, active, master, all_active
  }, null, 2));
}
test();
