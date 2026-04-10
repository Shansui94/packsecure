const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kdahubyhwndgyloaljak.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM');

async function test() {
  const { data: logs } = await supabase.from('production_logs_v2')
     .select('*')
     .order('created_at', { ascending: false })
     .limit(10);
  console.log("Recent Logs:", JSON.stringify(logs, null, 2));

  const { data: heartbeats } = await supabase.from('iot_device_configs')
     .select('machine_id, version, status')
     .order('last_heartbeat', { ascending: false })
     .limit(10);
  console.log("Heartbeats:", JSON.stringify(heartbeats, null, 2));

  const { data: active } = await supabase.from('machine_active_products')
     .select('*')
     .like('machine_id', '%T1.3%');
  console.log("Active for T1.3:", JSON.stringify(active, null, 2));

  // Check valid master items around "1M Single Layer"
  const { data: master } = await supabase.from('master_items_v2')
     .select('product_sku, item_name')
     .like('item_name', '%1M%Single%Layer%');
  console.log("Master Items for 1M Single Layer:", JSON.stringify(master, null, 2));

  const { data: unk } = await supabase.from('master_items_v2')
     .select('product_sku, item_name')
     .limit(5);
  console.log("Typical Master items:", JSON.stringify(unk, null, 2));
}
test();
