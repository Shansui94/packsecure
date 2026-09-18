import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkActive() {
    const { data } = await sb
        .from('sales_orders')
        .select('id, order_number, status, order_date, deadline, trip_origin, factory_id, customer, notes, trip_id')
        .neq('status', 'Delivered')
        .neq('status', 'Cancelled');

    console.log("Total active orders:", data.length);
    const byDate = {};
    const byFactory = {};
    data.forEach(d => {
        const dKey = `od:${d.order_date || 'null'} | dl:${d.deadline || 'null'}`;
        byDate[dKey] = (byDate[dKey] || 0) + 1;
        const fKey = d.trip_origin || d.factory_id || 'unknown';
        byFactory[fKey] = (byFactory[fKey] || 0) + 1;
    });

    console.log("By date:", byDate);
    console.log("By factory/origin:", byFactory);
}

checkActive().catch(console.error);
