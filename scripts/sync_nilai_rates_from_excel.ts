import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Syncing Nilai delivery rates from official Excel sheet...');

    // Normalize any mixed-case "Nilai" origin to uppercase "NILAI"
    await supabase.from('delivery_rates').update({ origin: 'NILAI' }).eq('origin', 'Nilai');

    const excelRates = [
        { location_name: 'KUALA SELANGOR', base_rate: 140, max_places: 5, extra_rate_per_place: 5 },
        { location_name: 'TANJUNG KARANG', base_rate: 140, max_places: 5, extra_rate_per_place: 5 },
        { location_name: 'SABAK BERNAM', base_rate: 160, max_places: 5, extra_rate_per_place: 5 },
        { location_name: 'KL', base_rate: 80, max_places: 1, extra_rate_per_place: 10 },
        { location_name: 'SELANGOR', base_rate: 80, max_places: 1, extra_rate_per_place: 10 },
        { location_name: 'NEGERI SEMBILAN', base_rate: 80, max_places: 2, extra_rate_per_place: 5 },
        { location_name: 'NILAI', base_rate: 30, max_places: 1, extra_rate_per_place: 0 },
        { location_name: 'NILAI (loose)', base_rate: 10, max_places: 1, extra_rate_per_place: 0 },
        { location_name: 'MELAKA', base_rate: 120, max_places: 2, extra_rate_per_place: 10 },
        { location_name: 'WEHENG / YANG IN', base_rate: 200, max_places: 1, extra_rate_per_place: 10 },
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
        { location_name: 'LIPIS', base_rate: 150, max_places: 2, extra_rate_per_place: 10 },
        { location_name: 'LIPAS', base_rate: 150, max_places: 2, extra_rate_per_place: 10 },
        { location_name: 'RAUB', base_rate: 150, max_places: 2, extra_rate_per_place: 10 },
        { location_name: 'JERANTUT', base_rate: 150, max_places: 2, extra_rate_per_place: 10 },
        { location_name: 'TEMERLOH', base_rate: 150, max_places: 2, extra_rate_per_place: 10 },
        { location_name: 'ROMPIN', base_rate: 250, max_places: 3, extra_rate_per_place: 10 },
        { location_name: 'PEKAN', base_rate: 250, max_places: 3, extra_rate_per_place: 10 },
        { location_name: 'KUANTAN', base_rate: 250, max_places: 3, extra_rate_per_place: 10 },
        { location_name: 'KEMAMAN TERENGGANU', base_rate: 280, max_places: 3, extra_rate_per_place: 10 },
        { location_name: 'KEMAMAN TERENG', base_rate: 280, max_places: 3, extra_rate_per_place: 10 },
        { location_name: 'PAKA', base_rate: 300, max_places: 3, extra_rate_per_place: 10 },
        { location_name: 'BATANG KALI', base_rate: 100, max_places: 3, extra_rate_per_place: 10 },
        { location_name: 'RASA', base_rate: 100, max_places: 3, extra_rate_per_place: 10 },
        { location_name: 'KAPAR', base_rate: 100, max_places: 3, extra_rate_per_place: 10 },
        { location_name: 'PUNCAK ALAM', base_rate: 100, max_places: 3, extra_rate_per_place: 10 },
        { location_name: 'DUNGUN', base_rate: 320, max_places: 3, extra_rate_per_place: 10 },
        { location_name: 'AMBIK PALLET', base_rate: 10, max_places: 0, extra_rate_per_place: 0 },
        { location_name: 'AMBIL PALLET', base_rate: 10, max_places: 0, extra_rate_per_place: 0 },
        { location_name: 'LORRY SERVICE', base_rate: 15, max_places: 0, extra_rate_per_place: 0 }
    ];

    for (const item of excelRates) {
        const { data: existing } = await supabase
            .from('delivery_rates')
            .select('id')
            .eq('origin', 'NILAI')
            .eq('location_name', item.location_name)
            .maybeSingle();

        if (existing) {
            const { error: updErr } = await supabase
                .from('delivery_rates')
                .update({
                    base_rate: item.base_rate,
                    max_places: item.max_places,
                    extra_rate_per_place: item.extra_rate_per_place,
                    notes: 'Official Excel: Nilai Origin',
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);

            if (updErr) console.error(`Error updating ${item.location_name}:`, updErr.message);
            else console.log(`✓ Updated NILAI - ${item.location_name}: RM ${item.base_rate}, max_places: ${item.max_places}, extra: +${item.extra_rate_per_place}`);
        } else {
            const { error: insErr } = await supabase
                .from('delivery_rates')
                .insert({
                    origin: 'NILAI',
                    location_name: item.location_name,
                    base_rate: item.base_rate,
                    max_places: item.max_places,
                    extra_rate_per_place: item.extra_rate_per_place,
                    notes: 'Official Excel: Nilai Origin'
                });

            if (insErr) console.error(`Error inserting ${item.location_name}:`, insErr.message);
            else console.log(`✓ Inserted NILAI - ${item.location_name}: RM ${item.base_rate}, max_places: ${item.max_places}, extra: +${item.extra_rate_per_place}`);
        }
    }

    console.log('Finished syncing Nilai rates.');
}

main().catch(console.error);
