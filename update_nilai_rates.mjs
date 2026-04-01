import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceKeyMatch = envFile.match(/.*SERVICE.*KEY=(.*)/);
const supabaseKey = serviceKeyMatch ? serviceKeyMatch[1].trim() : envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

const newRates = [
  { location_name: 'KUALA SELANGOR', base_rate: 140, max_places: 5, extra_rate_per_place: 5 },
  { location_name: 'TANJUNG KARANG', base_rate: 140, max_places: 5, extra_rate_per_place: 5 },
  { location_name: 'KL', base_rate: 80, max_places: 1, extra_rate_per_place: 10 },
  { location_name: 'SELANGOR', base_rate: 80, max_places: 1, extra_rate_per_place: 10 },
  { location_name: 'NEGERI SEMBILAN', base_rate: 80, max_places: 2, extra_rate_per_place: 5 },
  { location_name: 'NILAI', base_rate: 30, max_places: 1, extra_rate_per_place: 0 },
  { location_name: 'NILAI (loose)', base_rate: 10, max_places: 1, extra_rate_per_place: 0 },
  { location_name: 'MELAKA', base_rate: 120, max_places: 2, extra_rate_per_place: 10 },
  { location_name: 'WEHENG / YANG IN', base_rate: 200, max_places: 2, extra_rate_per_place: 10 },
  { location_name: 'JOHOR BAHRU', base_rate: 250, max_places: 3, extra_rate_per_place: 10 },
  { location_name: 'KULAI', base_rate: 250, max_places: 3, extra_rate_per_place: 10 },
  { location_name: 'PONTIAN', base_rate: 250, max_places: 3, extra_rate_per_place: 10 },
  { location_name: 'KOTA TINGGI', base_rate: 250, max_places: 3, extra_rate_per_place: 10 },
  { location_name: 'SEGAMAT', base_rate: 150, max_places: 2, extra_rate_per_place: 10 },
  { location_name: 'MUAR', base_rate: 150, max_places: 2, extra_rate_per_place: 10 },
  { location_name: 'TANGKAK', base_rate: 150, max_places: 2, extra_rate_per_place: 10 },
  { location_name: 'BATU PAHAT', base_rate: 200, max_places: 2, extra_rate_per_place: 10 },
  { location_name: 'KLUANG', base_rate: 200, max_places: 2, extra_rate_per_place: 10 },
  { location_name: 'MERSING', base_rate: 200, max_places: 2, extra_rate_per_place: 10 },
  { location_name: 'LABIS', base_rate: 200, max_places: 2, extra_rate_per_place: 10 },
  { location_name: 'BENTONG', base_rate: 80, max_places: 1, extra_rate_per_place: 10 },
  { location_name: 'KEMAYAN (PAHANG)', base_rate: 120, max_places: 2, extra_rate_per_place: 10 },
  { location_name: 'BERA', base_rate: 120, max_places: 2, extra_rate_per_place: 10 },
  { location_name: 'LIPAS', base_rate: 150, max_places: 2, extra_rate_per_place: 10 },
  { location_name: 'RAUB', base_rate: 150, max_places: 2, extra_rate_per_place: 10 },
  { location_name: 'JERANTUT', base_rate: 150, max_places: 2, extra_rate_per_place: 10 },
  { location_name: 'TEMERLOH', base_rate: 150, max_places: 2, extra_rate_per_place: 10 },
  { location_name: 'ROMPIN', base_rate: 250, max_places: 3, extra_rate_per_place: 10 },
  { location_name: 'PEKAN', base_rate: 250, max_places: 3, extra_rate_per_place: 10 },
  { location_name: 'KUANTAN', base_rate: 250, max_places: 3, extra_rate_per_place: 10 },
  { location_name: 'KEMAMAN TERENGGANU', base_rate: 280, max_places: 3, extra_rate_per_place: 10 },
  { location_name: 'AMBIK PALLET', base_rate: 10, max_places: 0, extra_rate_per_place: 0 },
  { location_name: 'LORRY SERVICE', base_rate: 15, max_places: 0, extra_rate_per_place: 0 },
  { location_name: 'PH', base_rate: 0, max_places: 0, extra_rate_per_place: 0 },
  { location_name: 'OFF DAY', base_rate: 0, max_places: 0, extra_rate_per_place: 0 },
  { location_name: 'STANDBY', base_rate: 0, max_places: 0, extra_rate_per_place: 0 },
  { location_name: 'MC', base_rate: 0, max_places: 0, extra_rate_per_place: 0 },
  { location_name: 'AL', base_rate: 0, max_places: 0, extra_rate_per_place: 0 },
  { location_name: 'NO TRIP', base_rate: 0, max_places: 0, extra_rate_per_place: 0 },
];

async function updateRates() {
    console.log(`Fetching existing rates for origin: Nilai...`);
    
    // 1. Fetch existing 'Nilai' records to preserve their UUIDs for an UPSERT
    const { data: existing, error: fetchErr } = await supabase
        .from('delivery_rates')
        .select('id, location_name')
        .eq('origin', 'Nilai');
        
    if (fetchErr) {
        console.error("Failed to fetch existing rates:", fetchErr);
        return;
    }
    
    // Create a map of location_name -> id
    const existingMap = {};
    existing.forEach(r => existingMap[r.location_name.toUpperCase()] = r.id);
    
    console.log(`Found ${existing.length} existing Nilai locations.`);
    
    // 2. Build upsert payload
    const payload = newRates.map(rate => {
        const _id = existingMap[rate.location_name.toUpperCase()];
        if (_id) {
            return { id: _id, origin: 'Nilai', ...rate }; // Exists -> Update
        } else {
            return { origin: 'Nilai', ...rate }; // New -> Create
        }
    });
    
    // 3. Perform Upsert
    const { error: upsertErr } = await supabase
        .from('delivery_rates')
        .upsert(payload);
        
    if (upsertErr) {
        console.error("Failed to upsert delivery rates:", upsertErr);
    } else {
        console.log(`Successfully upserted ${payload.length} Nilai delivery rates!`);
        
        let updatedCount = payload.filter(p => p.id).length;
        let createdCount = payload.filter(p => !p.id).length;
        console.log(`- Updated: ${updatedCount}`);
        console.log(`- Created: ${createdCount}`);
    }
}

updateRates();
