import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Syncing Johor delivery rates from official Excel sheet...');

    // Normalize any mixed-case "Johor" or "jb" origin to uppercase "JOHOR"
    await supabase.from('delivery_rates').update({ origin: 'JOHOR' }).ilike('origin', 'johor');

    const excelRates = [
        // User confirmed: WEHENG Tambah Tempat Rate in Excel (40) was a typo; correct rate is RM 10
        { location_name: 'WEHENG', base_rate: 40, max_places: 1, extra_rate_per_place: 10 },
        { location_name: 'WEHENG / YANG IN', base_rate: 40, max_places: 1, extra_rate_per_place: 10 },
        { location_name: 'JOHOR BAHRU', base_rate: 40, max_places: 1, extra_rate_per_place: 10 },
        { location_name: 'KULAI', base_rate: 30, max_places: 1, extra_rate_per_place: 10 },
        { location_name: 'KOTA TINGGI', base_rate: 50, max_places: 1, extra_rate_per_place: 10 },
        { location_name: 'PONTIAN', base_rate: 60, max_places: 1, extra_rate_per_place: 10 },
        { location_name: 'BATU PAHAT', base_rate: 90, max_places: 1, extra_rate_per_place: 10 },
        { location_name: 'KLUANG', base_rate: 90, max_places: 1, extra_rate_per_place: 10 },
        { location_name: 'LABIS', base_rate: 100, max_places: 1, extra_rate_per_place: 10 },
        { location_name: 'MUAR', base_rate: 120, max_places: 1, extra_rate_per_place: 10 },
        { location_name: 'TANGKAK', base_rate: 120, max_places: 1, extra_rate_per_place: 10 },
        { location_name: 'SEGAMAT', base_rate: 130, max_places: 1, extra_rate_per_place: 10 },
        { location_name: 'MERSING', base_rate: 130, max_places: 1, extra_rate_per_place: 10 },
        { location_name: 'MELAKA', base_rate: 160, max_places: 1, extra_rate_per_place: 10 },
        { location_name: 'LORRY SERVICE', base_rate: 15, max_places: 1, extra_rate_per_place: 0 },
        { location_name: 'LORRY PUSPAKOM', base_rate: 15, max_places: 1, extra_rate_per_place: 0 }
    ];

    for (const item of excelRates) {
        const { data: existing } = await supabase
            .from('delivery_rates')
            .select('id')
            .eq('origin', 'JOHOR')
            .eq('location_name', item.location_name)
            .maybeSingle();

        if (existing) {
            const { error: updErr } = await supabase
                .from('delivery_rates')
                .update({
                    base_rate: item.base_rate,
                    max_places: item.max_places,
                    extra_rate_per_place: item.extra_rate_per_place,
                    notes: 'Official Excel: Johor Origin',
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);

            if (updErr) console.error(`Error updating ${item.location_name}:`, updErr.message);
            else console.log(`✓ Updated JOHOR - ${item.location_name}: RM ${item.base_rate}, max_places: ${item.max_places}, extra: +${item.extra_rate_per_place}`);
        } else {
            const { error: insErr } = await supabase
                .from('delivery_rates')
                .insert({
                    origin: 'JOHOR',
                    location_name: item.location_name,
                    base_rate: item.base_rate,
                    max_places: item.max_places,
                    extra_rate_per_place: item.extra_rate_per_place,
                    notes: 'Official Excel: Johor Origin'
                });

            if (insErr) console.error(`Error inserting ${item.location_name}:`, insErr.message);
            else console.log(`✓ Inserted JOHOR - ${item.location_name}: RM ${item.base_rate}, max_places: ${item.max_places}, extra: +${item.extra_rate_per_place}`);
        }
    }

    console.log('Finished syncing Johor rates.');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
