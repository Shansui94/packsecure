import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Syncing Taiping delivery rates from official Excel sheet...');

    const updates = [
        {
            origin: 'TAIPING',
            location_name: 'KL',
            base_rate: 330,
            max_places: 3,
            extra_rate_per_place: 10,
            notes: 'Official Excel: KL (3 places included, +10/place)'
        },
        {
            origin: 'TAIPING',
            location_name: 'KARAK',
            base_rate: 330,
            max_places: 3,
            extra_rate_per_place: 10,
            notes: 'Official Excel: Karak (Pahang)'
        },
        {
            origin: 'TAIPING',
            location_name: 'JENGKA',
            base_rate: 380,
            max_places: 3,
            extra_rate_per_place: 10,
            notes: 'Official Excel: Jengka (Pahang)'
        },
        {
            origin: 'TAIPING',
            location_name: 'TAIPING TRIP',
            base_rate: 7,
            max_places: 1,
            extra_rate_per_place: 7,
            notes: 'Official Excel: Taiping Trip (+7/place extra)'
        },
        {
            origin: 'TAIPING',
            location_name: 'OPM - SHOPEE/SPD',
            base_rate: 20,
            max_places: 1,
            extra_rate_per_place: 20,
            notes: 'Official Excel: OPM - Shopee/Spd (+20/place extra)'
        },
        {
            origin: 'TAIPING',
            location_name: 'AMBIL PALLET',
            base_rate: 10,
            max_places: 0,
            extra_rate_per_place: 0,
            notes: 'Official Excel: Ambil Pallet'
        },
        {
            origin: 'TAIPING',
            location_name: 'AMBIK PALLET',
            base_rate: 10,
            max_places: 0,
            extra_rate_per_place: 0,
            notes: 'Alias for Ambil Pallet'
        }
    ];

    for (const item of updates) {
        // Check if exists
        const { data: existing } = await supabase
            .from('delivery_rates')
            .select('id')
            .eq('origin', item.origin)
            .eq('location_name', item.location_name)
            .maybeSingle();

        if (existing) {
            const { error: updErr } = await supabase
                .from('delivery_rates')
                .update({
                    base_rate: item.base_rate,
                    max_places: item.max_places,
                    extra_rate_per_place: item.extra_rate_per_place,
                    notes: item.notes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);

            if (updErr) console.error(`Error updating ${item.location_name}:`, updErr.message);
            else console.log(`✓ Updated ${item.location_name}: RM ${item.base_rate}, max_places: ${item.max_places}, extra: +${item.extra_rate_per_place}`);
        } else {
            const { error: insErr } = await supabase
                .from('delivery_rates')
                .insert({
                    origin: item.origin,
                    location_name: item.location_name,
                    base_rate: item.base_rate,
                    max_places: item.max_places,
                    extra_rate_per_place: item.extra_rate_per_place,
                    notes: item.notes
                });

            if (insErr) console.error(`Error inserting ${item.location_name}:`, insErr.message);
            else console.log(`✓ Inserted ${item.location_name}: RM ${item.base_rate}, max_places: ${item.max_places}, extra: +${item.extra_rate_per_place}`);
        }
    }

    console.log('Finished syncing rates.');
}

main().catch(console.error);
