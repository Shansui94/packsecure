import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://kdahubyhwndgyloaljak.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM'
);

async function checkSam() {
    // Find Sam's user ID
    const { data: users } = await supabase.from('users_public').select('id, name').ilike('name', '%sam%');
    console.log("Found drivers matching Sam:", users);

    if (users && users.length > 0) {
        const samId = users[0].id;
        console.log(`\nLooking for orders assigned to driver_id: ${samId}`);
        
        const { data: recentOrders } = await supabase
            .from('sales_orders')
            .select('id, do_number, status, created_at, customer, delivery_address')
            .eq('driver_id', samId)
            .order('created_at', { ascending: false })
            .limit(5);

        console.log("Recent DOs for Sam:", recentOrders);
        
        const { data: recentTrips } = await supabase
            .from('trips')
            .select('trip_id, status, created_at')
            .eq('driver_id', samId)
            .order('created_at', { ascending: false })
            .limit(5);

        console.log("Recent Trips for Sam:", recentTrips);
    } else {
        console.log("User Sam not found in users_public");
    }
}

checkSam().catch(console.error);
