import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TRIP_ID = 'cc966823-e20b-4b71-807d-bd271c15b67a'; // TRIP-261001-575
const ORDER_IDS = [
  'b17c2ab2-3f17-4ed7-bcce-c64978258f3e', // OPM2610-0037
  'e0f50f1f-4550-4fc4-9b11-531978f77928', // OPM2609-1220
  'f6b43882-7e8f-4ec9-a685-d1dd47c4c3fe'  // OPM2609-1149
];

async function main() {
  console.log('=== Step 1: Pre-execution check ===');
  const { data: orders, error: oErr } = await supabase
    .from('sales_orders')
    .select('id, order_number, status, notes, pod_photo_url, pod_signature_url')
    .in('id', ORDER_IDS);

  if (oErr) {
    console.error('Error fetching orders:', oErr);
    process.exit(1);
  }

  console.log(`Found ${orders?.length} orders:`);
  for (const ord of (orders || [])) {
    console.log(`- ${ord.order_number}: status=${ord.status}`);
    const photos = (ord.pod_photo_url || '').split(',');
    const doPhoto = photos[0]; // unload_do_later_...
    console.log(`  DO Photo: ${doPhoto}`);

    let cleanNotes = (ord.notes || '')
      .replace(/\[.*?Menunggu gambar DO.*?\]/g, '')
      .replace(/\[.*?Pending signed DO.*?\]/g, '')
      .trim();
    cleanNotes += '\n[02/10 16:55] ✅ DO telah disahkan. Penghantaran lengkap.';

    const { error: upErr } = await supabase
      .from('sales_orders')
      .update({
        status: 'Delivered',
        notes: cleanNotes,
        pod_signature_url: doPhoto || ord.pod_signature_url
      })
      .eq('id', ord.id);

    if (upErr) {
      console.error(`Failed to update ${ord.order_number}:`, upErr);
    } else {
      console.log(`  Updated ${ord.order_number} to Delivered and cleaned notes.`);
    }
  }

  console.log('\n=== Step 2: Completing trip_stops_v2 ===');
  const { error: stopsErr } = await supabase
    .from('trip_stops_v2')
    .update({ status: 'Completed' })
    .eq('trip_id', TRIP_ID);
  if (stopsErr) console.warn('trip_stops_v2 update notice:', stopsErr.message);

  console.log('\n=== Step 3: Completing trips_v2 ===');
  const { data: tripUpdated, error: tripErr } = await supabase
    .from('trips_v2')
    .update({
      status: 'Completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', TRIP_ID)
    .select('id, trip_number, status, completed_at');

  if (tripErr) {
    console.error('Failed to update trip:', tripErr);
  } else {
    console.log('Trip successfully completed:', tripUpdated);
  }
}

main();
