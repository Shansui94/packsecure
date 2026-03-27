import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://kdahubyhwndgyloaljak.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM'
);

async function findSamOrder() {
    console.log("=== Last 5 Trips ===");
    const { data: trips } = await supabase
        .from('trips')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    trips?.forEach(t => console.log(`Trip ${t.trip_id} | Driver: ${t.driver_name || t.assigned_driver} | Status: ${t.status} | Created: ${t.created_at}`));

    console.log("\n=== Last 5 Sales Orders ===");
    const { data: orders } = await supabase
        .from('sales_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    orders?.forEach(o => console.log(`DO ${o.id || o.do_number} | Driver: ${o.driver_name || o.assigned_driver} | Created: ${o.created_at}`));
}

findSamOrder().catch(console.error);
