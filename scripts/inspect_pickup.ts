import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function inspect() {
  console.log('Querying pickup orders...');
  const { data: orders, error } = await supabase
    .from('sales_orders')
    .select('id, order_number, customer, zone, driver_id, status, notes, delivery_address, order_date, created_at')
    .or('zone.ilike.%pickup%,notes.ilike.%pickup%,notes.ilike.%ambil%,customer.ilike.%pickup%,delivery_address.ilike.%pickup%')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${(orders || []).length} orders related to pickup:`);
  for (const o of (orders || [])) {
    console.log(`[${o.order_number}] Customer: ${o.customer} | Zone: ${o.zone} | Status: ${o.status} | DriverId: ${o.driver_id} | Date: ${o.delivery_date} | Notes: ${o.notes}`);
  }

  // Check distinct zones
  const { data: zones } = await supabase.from('sales_orders').select('zone').limit(300);
  const distinctZones = Array.from(new Set((zones || []).map(z => z.zone).filter(Boolean)));
  console.log('\nDistinct Zones:', distinctZones);

  // Check users/drivers with pickup in name or role
  const { data: users } = await supabase.from('users_public').select('uid, name, role, email').or('name.ilike.%pickup%,role.ilike.%pickup%');
  console.log('\nPickup users/drivers:', users);
}

inspect().catch(console.error);
