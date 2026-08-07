import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceKeyMatch = envFile.match(/.*SERVICE.*KEY=(.*)/);
const supabaseKey = serviceKeyMatch ? serviceKeyMatch[1].trim() : envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

const johorRates = [
  { origin: 'JOHOR', location_name: 'WEHENG', base_rate: 40, max_places: 1, extra_rate_per_place: 0 },
  { origin: 'JOHOR', location_name: 'JB', base_rate: 40, max_places: 1, extra_rate_per_place: 10 },
  { origin: 'JOHOR', location_name: 'JOHOR BAHRU', base_rate: 40, max_places: 1, extra_rate_per_place: 10 },
  { origin: 'JOHOR', location_name: 'KULAI', base_rate: 30, max_places: 1, extra_rate_per_place: 10 },
  { origin: 'JOHOR', location_name: 'KOTA TINGGI', base_rate: 50, max_places: 1, extra_rate_per_place: 10 },
  { origin: 'JOHOR', location_name: 'PONTIAN', base_rate: 60, max_places: 1, extra_rate_per_place: 10 },
  { origin: 'JOHOR', location_name: 'BATU PAHAT', base_rate: 90, max_places: 1, extra_rate_per_place: 10 },
  { origin: 'JOHOR', location_name: 'KLUANG', base_rate: 90, max_places: 1, extra_rate_per_place: 10 },
  { origin: 'JOHOR', location_name: 'MUAR', base_rate: 120, max_places: 1, extra_rate_per_place: 10 },
  { origin: 'JOHOR', location_name: 'TANGKAK', base_rate: 120, max_places: 1, extra_rate_per_place: 10 },
  { origin: 'JOHOR', location_name: 'SEGAMAT', base_rate: 130, max_places: 1, extra_rate_per_place: 10 },
  { origin: 'JOHOR', location_name: 'MERSING', base_rate: 130, max_places: 1, extra_rate_per_place: 10 },
  { origin: 'JOHOR', location_name: 'AMBIK PALLET', base_rate: 10, max_places: 0, extra_rate_per_place: 0 },
  { origin: 'JOHOR', location_name: 'LORRY SERVICE', base_rate: 15, max_places: 0, extra_rate_per_place: 0 }
];

const kelantanRates = [
  { origin: 'KELANTAN', location_name: 'KOTA BHARU', base_rate: 20, max_places: 1, extra_rate_per_place: 5 },
  { origin: 'KELANTAN', location_name: 'PASIR MAS', base_rate: 30, max_places: 1, extra_rate_per_place: 5 },
  { origin: 'KELANTAN', location_name: 'TUMPAT', base_rate: 30, max_places: 1, extra_rate_per_place: 5 },
  { origin: 'KELANTAN', location_name: 'PASIR PUTEH', base_rate: 40, max_places: 1, extra_rate_per_place: 5 },
  { origin: 'KELANTAN', location_name: 'BACHOK', base_rate: 30, max_places: 1, extra_rate_per_place: 5 },
  { origin: 'KELANTAN', location_name: 'MACHANG', base_rate: 40, max_places: 1, extra_rate_per_place: 10 },
  { origin: 'KELANTAN', location_name: 'TANAH MERAH', base_rate: 50, max_places: 1, extra_rate_per_place: 10 },
  { origin: 'KELANTAN', location_name: 'KUALA KRAI', base_rate: 60, max_places: 1, extra_rate_per_place: 10 },
  { origin: 'KELANTAN', location_name: 'JELI', base_rate: 80, max_places: 1, extra_rate_per_place: 10 },
  { origin: 'KELANTAN', location_name: 'GUA MUSANG', base_rate: 160, max_places: 1, extra_rate_per_place: 10 },
  { origin: 'KELANTAN', location_name: 'AMBIK PALLET', base_rate: 10, max_places: 0, extra_rate_per_place: 0 },
  { origin: 'KELANTAN', location_name: 'LORRY SERVICE', base_rate: 15, max_places: 0, extra_rate_per_place: 0 }
];

async function updateRates() {
  console.log("Upserting Johor & Kelantan rates into delivery_rates...");
  const allRates = [...johorRates, ...kelantanRates];

  const { data: existing, error: fetchErr } = await supabase
    .from('delivery_rates')
    .select('id, origin, location_name');

  if (fetchErr) {
    console.error("Fetch error:", fetchErr);
    return;
  }

  const existingMap = {};
  existing.forEach(r => {
    const key = `${(r.origin || '').toUpperCase()}-${(r.location_name || '').toUpperCase()}`;
    existingMap[key] = r.id;
  });

  const payload = allRates.map(r => {
    const key = `${r.origin.toUpperCase()}-${r.location_name.toUpperCase()}`;
    const id = existingMap[key];
    return id ? { id, ...r } : r;
  });

  const { data, error: upsertErr } = await supabase
    .from('delivery_rates')
    .upsert(payload);

  if (upsertErr) {
    console.error("Upsert error:", upsertErr);
  } else {
    console.log(`Successfully upserted ${payload.length} rates for JOHOR and KELANTAN!`);
  }
}

updateRates();
