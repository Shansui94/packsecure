import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env', 'utf-8');
const url = envText.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function main() {
  console.log("Seeding machine and factory login rates into machine_rates table...");

  const ratesToSeed = [
    // Taiping Machines
    { machine_id: 'T1-M03', operator_hourly_rate: 10, manager_piece_rate: 15 },
    { machine_id: 'T4-M04', operator_hourly_rate: 10, manager_piece_rate: 15 },
    { machine_id: 'T2-M01', operator_hourly_rate: 10, manager_piece_rate: 15 },
    { machine_id: 'T5-M05', operator_hourly_rate: 10, manager_piece_rate: 10 },
    { machine_id: 'T3-M02', operator_hourly_rate: 8,  manager_piece_rate: 13 },

    // Nilai Machines
    { machine_id: 'N1-M01', operator_hourly_rate: 10, manager_piece_rate: 15 },
    { machine_id: 'N2-M02', operator_hourly_rate: 10, manager_piece_rate: 15 },
    { machine_id: 'N3-M03', operator_hourly_rate: 10, manager_piece_rate: 10 },

    // Factory Login Modes (不登录机器，登录工厂)
    { machine_id: 'FACTORY_MODE_1', operator_hourly_rate: 8, manager_piece_rate: 12 },
    { machine_id: 'FACTORY_MODE_2', operator_hourly_rate: 10, manager_piece_rate: 10 },

    // Additional Factory IDs
    { machine_id: 'FACTORY-TAIPING', operator_hourly_rate: 8, manager_piece_rate: 12 },
    { machine_id: 'FACTORY-NILAI', operator_hourly_rate: 8, manager_piece_rate: 12 },
    { machine_id: 'FACTORY-JOHOR', operator_hourly_rate: 8, manager_piece_rate: 12 },
    { machine_id: 'FACTORY-KELANTAN', operator_hourly_rate: 8, manager_piece_rate: 12 },
  ];

  const { error } = await supabase.from('machine_rates').upsert(ratesToSeed, { onConflict: 'machine_id' });

  if (error) {
    console.error("Failed to seed machine_rates:", error.message);
  } else {
    console.log(`✅ Successfully seeded ${ratesToSeed.length} machine and factory login rate records!`);
  }
}

main();
