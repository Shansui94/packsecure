import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

async function run() {
  const supabase = createClient(url, serviceKey);

  console.log("Setting up multi-drop test scenario for driver '296c7093-9633-4aca-8ba0-0847464df195'...");

  // 1. Update the original order to represent Drop 1
  const { error: err1 } = await supabase
    .from('sales_orders')
    .update({
      customer: 'Drop 1: Client A (Ipoh)',
      delivery_address: '12, Jalan Sultan Yusof, 30000 Ipoh, Perak',
      status: 'New',
      proof_of_load_url: null,
      pod_photo_url: null,
      pod_timestamp: null,
      notes: 'Please call customer before arrival.',
      trip_drop_count: 5
    })
    .eq('order_number', 'DO-DRIVER-260608-001');

  if (err1) {
    console.error("Error updating original order:", err1);
    return;
  }
  console.log("Original order updated successfully as Drop 1.");

  // Delete any pre-existing DO-DRIVER-260608-002 to 005 to prevent duplicates
  await supabase.from('sales_orders').delete().in('order_number', [
    'DO-DRIVER-260608-002',
    'DO-DRIVER-260608-003',
    'DO-DRIVER-260608-004',
    'DO-DRIVER-260608-005'
  ]);

  // 2. Insert 4 additional orders (Drop 2 to Drop 5)
  const items = [
    {
      sku: "TEST-001",
      remark: "5 Rolls",
      product: "testtt",
      quantity: 5,
      packaging: "kg",
      sourceLocation: "SPD"
    }
  ];

  const newOrders = [
    {
      order_number: 'DO-DRIVER-260608-002',
      customer: 'Drop 2: Client B (Kampar)',
      delivery_address: '45, Jalan Masjid, 31900 Kampar, Perak',
      status: 'New',
      order_date: '2026-06-08',
      deadline: '2026-06-09',
      driver_id: '296c7093-9633-4aca-8ba0-0847464df195',
      trip_origin: 'TAIPING',
      trip_drop_count: 5,
      items: items,
      notes: 'Unload at rear warehouse door.',
      factory_id: 'SPD'
    },
    {
      order_number: 'DO-DRIVER-260608-003',
      customer: 'Drop 3: Client C (Bidor)',
      delivery_address: '8, Jalan Besar, 35500 Bidor, Perak',
      status: 'New',
      order_date: '2026-06-08',
      deadline: '2026-06-09',
      driver_id: '296c7093-9633-4aca-8ba0-0847464df195',
      trip_origin: 'TAIPING',
      trip_drop_count: 5,
      items: items,
      notes: 'Request receiver signature on yellow copy.',
      factory_id: 'SPD'
    },
    {
      order_number: 'DO-DRIVER-260608-004',
      customer: 'Drop 4: Client D (Sungkai)',
      delivery_address: '101, Jalan Stesen, 35600 Sungkai, Perak',
      status: 'New',
      order_date: '2026-06-08',
      deadline: '2026-06-09',
      driver_id: '296c7093-9633-4aca-8ba0-0847464df195',
      trip_origin: 'TAIPING',
      trip_drop_count: 5,
      items: items,
      notes: 'Guardhouse verification needed.',
      factory_id: 'SPD'
    },
    {
      order_number: 'DO-DRIVER-260608-005',
      customer: 'Drop 5: Client E (Tanjung Malim)',
      delivery_address: '22, Jalan Permai, 35900 Tanjung Malim, Perak',
      status: 'New',
      order_date: '2026-06-08',
      deadline: '2026-06-09',
      driver_id: '296c7093-9633-4aca-8ba0-0847464df195',
      trip_origin: 'TAIPING',
      trip_drop_count: 5,
      items: items,
      notes: 'Final drop of the trip.',
      factory_id: 'SPD'
    }
  ];

  console.log("Inserting 4 new test orders...");
  const { data, error } = await supabase.from('sales_orders').insert(newOrders).select();

  if (error) {
    console.error("Error inserting test orders:", error);
  } else {
    console.log(`Successfully created ${data.length} new test drops. All set!`);
  }
}

run();
