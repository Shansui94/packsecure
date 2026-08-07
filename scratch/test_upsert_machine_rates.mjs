import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env', 'utf-8');
const url = envText.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function main() {
  const initialRates = [
    { machine_id: 'T1-M03', operator_hourly_rate: 10, manager_piece_rate: 15 },
    { machine_id: 'T4-M04', operator_hourly_rate: 10, manager_piece_rate: 15 },
    { machine_id: 'T2-M01', operator_hourly_rate: 10, manager_piece_rate: 15 },
    { machine_id: 'T5-M05', operator_hourly_rate: 10, manager_piece_rate: 10 },
    { machine_id: 'T3-M02', operator_hourly_rate: 8,  manager_piece_rate: 13 },
    { machine_id: 'N1-M01', operator_hourly_rate: 10, manager_piece_rate: 15 },
    { machine_id: 'N2-M02', operator_hourly_rate: 10, manager_piece_rate: 15 },
    { machine_id: 'N3-M03', operator_hourly_rate: 10, manager_piece_rate: 10 },
    { machine_id: 'FACTORY_MODE_1', operator_hourly_rate: 8, manager_piece_rate: 12 },
    { machine_id: 'FACTORY_MODE_2', operator_hourly_rate: 10, manager_piece_rate: 10 }
  ];

  const { error } = await supabase.from('machine_rates').upsert(initialRates, { onConflict: 'machine_id' });
  console.log('Upsert result error:', error);

  const { data: allRates } = await supabase.from('machine_rates').select('*');
  console.log('All machine_rates in DB:', JSON.stringify(allRates, null, 2));
}

main();
