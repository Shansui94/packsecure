import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MAX_TAN_USER_ID = 'd1c24ad1-85c2-4f45-9b6d-d3bb36e13390'; // SuperAdmin / Driver Max Tan
const LORRY_ID = '23572333-dba1-421a-b6fd-83d937cfe954'; // APD 9821
const TRIP_DATE = '2026-09-19';

async function generateTestTrip() {
  console.log('=== Step 1: Assign Lorry APD 9821 to Max Tan ===');
  const { error: lorryErr } = await supabase
    .from('lorries')
    .update({
      driver_id: MAX_TAN_USER_ID,
      driver_name: 'Max Tan',
      status: 'In-Use'
    })
    .eq('id', LORRY_ID);

  if (lorryErr) {
    console.warn('Notice updating lorry:', lorryErr.message);
  } else {
    console.log('Lorry APD 9821 bound to Max Tan successfully.');
  }

  console.log('\n=== Step 2: Create Trip in trips_v2 ===');
  const tripId = crypto.randomUUID();
  const tripNumber = 'TRIP-260919-MAX01';

  const { data: tripData, error: tripErr } = await supabase
    .from('trips_v2')
    .insert({
      id: tripId,
      trip_number: tripNumber,
      driver_id: MAX_TAN_USER_ID,
      lorry_id: LORRY_ID,
      status: 'Planned',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (tripErr) {
    console.error('Failed to create trip_v2:', tripErr);
    return;
  }
  console.log('Created Trip:', tripData);

  console.log('\n=== Step 3: Create 10 Test Drops (sales_orders) ===');
  const dropsConfig = [
    {
      seq: 1,
      customer: 'TEST DROP 01 - KEDAI PLASTIK TAIPING',
      address: '12, Jalan Tupai, 34000 Taiping, Perak',
      zone: 'TAIPING',
      items: [
        { sku: 'BW-SL-CLR-100Mx100CMx1ROLL-RED', product: 'MERAH (100M x 100CM)', quantity: 20, packaging: 'Roll', sourceLocation: 'OPM Lama' }
      ],
      notes: 'Drop 1/10 | Unload first | Tel: 012-3456701 | Terms: C.O.D.'
    },
    {
      seq: 2,
      customer: 'TEST DROP 02 - KAMUNTING PACKAGING TRADING',
      address: '45, Jalan Kamunting Maju, 34600 Kamunting, Perak',
      zone: 'TAIPING',
      items: [
        { sku: 'BW-DL-CLR-100Mx100CMx1ROLL-YEL', product: 'DL-FULL (Double Layer 100M)', quantity: 15, packaging: 'Roll', sourceLocation: 'OPM Lama' },
        { sku: 'CUKUPP-CLEAR-TAPE-80M', product: 'CKP CLEAR TAPE 80M', quantity: 2, packaging: 'Box', sourceLocation: 'OPM Corner' }
      ],
      notes: 'Drop 2/10 | Back entrance | Tel: 016-5551202 | Terms: 30 Days'
    },
    {
      seq: 3,
      customer: 'TEST DROP 03 - SIMPANG LOGISTICS & HARDWARE',
      address: '88, Jalan Simpang, 34700 Simpang, Perak',
      zone: 'TAIPING',
      items: [
        { sku: 'BW-SL-CLR-100Mx50CMx2ROLL-RED', product: 'MERAH HALF (50CM x 2)', quantity: 10, packaging: 'Roll', sourceLocation: 'OPM Lama' }
      ],
      notes: 'Drop 3/10 | Tel: 017-8899303 | Terms: C.O.D.'
    },
    {
      seq: 4,
      customer: 'TEST DROP 04 - BUKIT MERTAJAM INDO MART',
      address: '101, Jalan Kota Permai, 14000 Bukit Mertajam, Penang',
      zone: 'PENANG',
      items: [
        { sku: 'CUKUPP-CLEAR-TAPE-80M', product: 'CUKUPP CLEAR TAPE 80M', quantity: 6, packaging: 'Box', sourceLocation: 'OPM Corner' },
        { sku: 'CUKUPP-FRAGILE-TAPE-80M', product: 'CUKUPP FRAGILE TAPE 80M', quantity: 2, packaging: 'Box', sourceLocation: 'OPM Corner' }
      ],
      notes: 'Drop 4/10 | Need receipt stamp | Tel: 012-9901404 | Terms: C.O.D.'
    },
    {
      seq: 5,
      customer: 'TEST DROP 05 - PRAI INDUSTRIAL SUPPLIES SDN BHD',
      address: '23, Tingkat Perusahaan 6, Kawasan Perusahaan Prai, 13600 Prai, Penang',
      zone: 'PENANG',
      items: [
        { sku: 'BW-SL-CLR-100Mx100CMx1ROLL-RED', product: 'MERAH (100M x 100CM)', quantity: 30, packaging: 'Roll', sourceLocation: 'OPM Lama' }
      ],
      notes: 'Drop 5/10 | Loading Bay 3 | Tel: 04-3901505 | Terms: 30 Days'
    },
    {
      seq: 6,
      customer: 'TEST DROP 06 - AUTO CITY ACCESSORIES HUB',
      address: '1688, Jalan Perusahaan, Auto-City, 13600 Perai, Penang',
      zone: 'PENANG',
      items: [
        { sku: 'BW-DL-CLR-100Mx50CMx2ROLL-BLU', product: 'DL-HALF (50CM x 2)', quantity: 12, packaging: 'Roll', sourceLocation: 'OPM Lama' }
      ],
      notes: 'Drop 6/10 | Call manager upon arrival | Tel: 019-4456606 | Terms: C.O.D.'
    },
    {
      seq: 7,
      customer: 'TEST DROP 07 - BUTTERWORTH PACKAGING ENTERPRISE',
      address: '55, Jalan Raja Uda, 12300 Butterworth, Penang',
      zone: 'PENANG',
      items: [
        { sku: 'BW-SL-CLR-100Mx100CMx1ROLL-RED', product: 'MERAH (100M x 100CM)', quantity: 18, packaging: 'Roll', sourceLocation: 'OPM Lama' },
        { sku: 'AIRTUBE-40CM-300M', product: 'AIR TUBE 40CM x 300M', quantity: 2, packaging: 'Roll', sourceLocation: 'OPM Corner' }
      ],
      notes: 'Drop 7/10 | Tel: 012-4217707 | Terms: C.O.D.'
    },
    {
      seq: 8,
      customer: 'TEST DROP 08 - KEPALA BATAS AGRI STORE',
      address: '77, Jalan Bertam Maju, 13200 Kepala Batas, Penang',
      zone: 'PENANG',
      items: [
        { sku: 'BW-SL-CLR-100Mx100CMx1ROLL-RED', product: 'MERAH (100M x 100CM)', quantity: 15, packaging: 'Roll', sourceLocation: 'OPM Lama' }
      ],
      notes: 'Drop 8/10 | Near market | Tel: 013-4889808 | Terms: C.O.D.'
    },
    {
      seq: 9,
      customer: 'TEST DROP 09 - SUNGAI PETANI PACK & WRAP MART',
      address: '32, Kawasan Perindustrian Bakar Arang, 08000 Sungai Petani, Kedah',
      zone: 'KEDAH',
      items: [
        { sku: 'BW-DL-CLR-100Mx100CMx1ROLL-YEL', product: 'DL-FULL (Double Layer 100M)', quantity: 20, packaging: 'Roll', sourceLocation: 'OPM Lama' },
        { sku: 'CUKUPP-CLEAR-TAPE-80M', product: 'CKP CLEAR TAPE 80M', quantity: 4, packaging: 'Box', sourceLocation: 'OPM Corner' }
      ],
      notes: 'Drop 9/10 | Tel: 017-4022909 | Terms: C.O.D.'
    },
    {
      seq: 10,
      customer: 'TEST DROP 10 - ALOR SETAR DISTRIBUTOR SDN BHD',
      address: '99, Jalan Mergong 2, Mergong Barrage, 05150 Alor Setar, Kedah',
      zone: 'KEDAH',
      items: [
        { sku: 'BW-SL-CLR-100Mx100CMx1ROLL-RED', product: 'MERAH (100M x 100CM)', quantity: 40, packaging: 'Roll', sourceLocation: 'OPM Lama' }
      ],
      notes: 'Drop 10/10 | Final Drop | Tel: 019-5501010 | Terms: 30 Days'
    }
  ];

  const ordersToInsert = dropsConfig.map((cfg) => {
    const padSeq = String(cfg.seq).padStart(3, '0');
    return {
      id: crypto.randomUUID(),
      trip_id: tripId,
      order_number: `DO-MAX-260919-${padSeq}`,
      customer: cfg.customer,
      delivery_address: cfg.address,
      zone: cfg.zone,
      trip_origin: 'TAIPING',
      trip_drop_count: 10,
      stop_sequence: cfg.seq,
      trip_sequence: cfg.seq,
      driver_id: MAX_TAN_USER_ID,
      items: cfg.items,
      order_date: TRIP_DATE,
      deadline: TRIP_DATE,
      notes: cfg.notes,
      status: 'Planned',
      delivery_method: 'Company Delivery',
      job_type: 'Delivery',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  });

  const { data: insertedOrders, error: orderErr } = await supabase
    .from('sales_orders')
    .insert(ordersToInsert)
    .select('id, order_number, customer, stop_sequence, status');

  if (orderErr) {
    console.error('Failed to insert sales_orders:', orderErr);
    return;
  }

  console.log(`\nSuccessfully created ${insertedOrders.length} test drops:`);
  insertedOrders.forEach(o => {
    console.log(`- Stop ${o.stop_sequence}: ${o.order_number} -> ${o.customer} (${o.status})`);
  });

  console.log('\n=== TRIP GENERATION COMPLETE ===');
  console.log(`Trip Number: ${tripNumber}`);
  console.log(`Trip ID: ${tripId}`);
  console.log(`Assigned Driver: Max Tan (${MAX_TAN_USER_ID})`);
  console.log(`Assigned Lorry: APD 9821 (${LORRY_ID})`);
  console.log(`Total Drops: 10`);
}

generateTestTrip().catch(console.error);
