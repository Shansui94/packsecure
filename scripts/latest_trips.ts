import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://kdahubyhwndgyloaljak.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM'
);

async function findLatestTrips() {
    console.log("=== Latest 5 Trips today ===");
    const { data: trips } = await supabase
        .from('trips')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    trips?.forEach(t => console.log(`Trip ${t.trip_id} | driver: ${t.driver_name} | status: ${t.status} | category: ${t.category} | created: ${t.created_at}`));

    console.log("\n=== Latest 5 Delivery Orders today ===");
    const { data: orders } = await supabase
        .from('sales_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    orders?.forEach(o => console.log(`DO ${o.do_number} | driver: ${o.driver} | location: ${o.location} | status: ${o.status} | created: ${o.created_at}`));
}

findLatestTrips().catch(console.error);
