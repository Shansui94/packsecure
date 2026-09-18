import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    console.log("=== DAILY PREP AUDIT ===");

    // 1. Check open/active sales orders
    const { data: openOrders, error: oErr } = await sb
        .from('sales_orders')
        .select('id, order_number, customer, status, order_date, deadline, trip_origin, factory_id, trip_id, notes, preparation_photo_url')
        .neq('status', 'Cancelled')
        .neq('status', 'Delivered')
        .order('order_date', { ascending: false })
        .limit(30);

    if (oErr) {
        console.error("Order query error:", oErr);
    } else {
        console.log(`Found ${openOrders.length} recent non-cancelled/non-delivered orders:`);
        openOrders.slice(0, 10).forEach(o => {
            console.log(`- [${o.order_number}] Status: ${o.status}, OrderDate: ${o.order_date}, Deadline: ${o.deadline}, Origin: ${o.trip_origin || o.factory_id}, TripID: ${o.trip_id || 'none'}, Photos: ${o.preparation_photo_url ? 'YES' : 'NO'}`);
        });
    }

    // 2. Check total counts by status in sales_orders
    const { data: allStatuses, error: sErr } = await sb
        .from('sales_orders')
        .select('status');
    if (!sErr && allStatuses) {
        const counts = {};
        allStatuses.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
        console.log("\nSales orders status breakdown:", counts);
    }

    // 3. Check trips_v2
    const { data: recentTrips, error: tErr } = await sb
        .from('trips_v2')
        .select('id, trip_number, created_at, status, driver_id, lorry_id, preparation_photo_url')
        .order('created_at', { ascending: false })
        .limit(15);

    if (tErr) {
        console.error("Trips_v2 query error:", tErr);
    } else {
        console.log(`\nFound ${recentTrips.length} recent trips_v2:`);
        recentTrips.forEach(t => {
            console.log(`- [${t.trip_number}] Created: ${t.created_at}, Status: ${t.status}, Driver: ${t.driver_id}, Photos: ${t.preparation_photo_url ? 'YES' : 'NO'}`);
        });
    }

    // 4. Check today's date in local time
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    console.log(`\nCurrent Date (ISO): ${todayStr}`);

    // Check today's sales_orders
    const { data: todayOrders } = await sb
        .from('sales_orders')
        .select('id, order_number, customer, status, order_date, deadline, trip_origin, factory_id, trip_id, notes, items, driver_id')
        .neq('status', 'Cancelled')
        .neq('status', 'Delivered')
        .or(`order_date.eq.${todayStr},deadline.eq.${todayStr}`);
    
    console.log(`\nToday's non-cancelled/non-delivered orders (${todayStr}): ${todayOrders?.length || 0}`);
    
    const byFactory = { Taiping: [], Nilai: [], Kelantan: [], Johor: [] };
    const getOrderFactory = (order) => {
        const orig = (order.trip_origin || '').toUpperCase().trim();
        if (orig.includes('NILAI') || orig === 'N1') return 'Nilai';
        if (orig.includes('KELANTAN') || orig === 'K1') return 'Kelantan';
        if (orig.includes('JOHOR') || orig === 'J1') return 'Johor';
        if (orig.includes('TAIPING') || orig === 'T1' || orig.includes('OPM') || orig.includes('SPD')) return 'Taiping';
        const text = `${order.zone || ''} ${order.delivery_address || ''}`.toLowerCase();
        if (text.includes('nilai') || text.includes('seremban') || text.includes('kl') || text.includes('selangor') || text.includes('kuala lumpur')) return 'Nilai';
        if (text.includes('kelantan') || text.includes('kota bharu') || text.includes('terengganu')) return 'Kelantan';
        if (text.includes('johor') || text.includes('skudai') || text.includes('senai') || text.includes('jb')) return 'Johor';
        return 'Taiping';
    };

    (todayOrders || []).forEach(o => {
        const f = getOrderFactory(o);
        byFactory[f].push(o);
    });

    Object.entries(byFactory).forEach(([f, list]) => {
        console.log(`\n--- Factory: ${f} (${list.length} orders) ---`);
        list.forEach(o => {
            const rolls = (o.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
            console.log(`  * [${o.order_number}] Status: ${o.status}, Driver: ${o.driver_id || 'none'}, TripID: ${o.trip_id || 'none'}, Rolls: ${rolls}, Notes: ${o.notes || ''}`);
        });
    });
}

main().catch(console.error);
