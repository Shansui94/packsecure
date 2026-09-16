import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkV2() {
    const { data: t2, error: e2 } = await sb.from('trips_v2').select('*').limit(1);
    console.log("trips_v2:", e2 ? e2.message : `EXISTS (${t2.length} rows)`);

    const { data: s2, error: es2 } = await sb.from('trip_stops_v2').select('*').limit(1);
    console.log("trip_stops_v2:", es2 ? es2.message : `EXISTS (${s2.length} rows)`);
}

checkV2().catch(console.error);
