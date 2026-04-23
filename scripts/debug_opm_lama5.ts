import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    // If we want to check why it's not writing to the ledger, let's look at the actual entries from today for 'OPM Lama'
    // OPM Lama is a location.
    const { data: locations } = await supabase.from('sys_locations_v2').select('*');
    console.log("Locations v2:", locations);
    
    const { data: locations1 } = await supabase.from('sys_locations').select('*');
    console.log("Locations v1:", locations1);
}
main();
