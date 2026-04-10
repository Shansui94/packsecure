const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kdahubyhwndgyloaljak.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM');

async function test() {
  // Check recent production logs
  const { data: logs } = await supabase.from('production_logs_v2')
     .select('*')
     .order('created_at', { ascending: false })
     .limit(10);
  console.log("Recent Logs:\n", logs);

  // Check what machine_id esp32s are actually using in the last 20 IoT heartbeats
  const { data: heartbeats } = await supabase.from('iot_device_configs')
     .select('machine_id, version, status')
     .order('last_heartbeat', { ascending: false })
     .limit(10);
  console.log("Heartbeats:\n", heartbeats);

  // Check the active sku for T1.3-M02
  const { data: active } = await supabase.from('machine_active_products')
     .select('*')
     .like('machine_id', '%T1.3%');
  console.log("Active for T1.3:\n", active);
}

test();
