import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fullReport() {
    const today = '2026-03-26';
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // 1. MERAH production today (product_sku contains RED)
    console.log("=== MERAH (RED) Production Today ===");
    const { data: merahProd } = await supabase
        .from('production_logs')
        .select('id, machine_id, alarm_count, created_at, product_sku, lane_id')
        .ilike('product_sku', '%RED%')
        .gte('created_at', today)
        .order('created_at', { ascending: false });

    console.log(`Total pulses today: ${merahProd?.length || 0}`);
    
    // Group by machine
    const byMachine: Record<string, number> = {};
    merahProd?.forEach(p => {
        byMachine[p.machine_id] = (byMachine[p.machine_id] || 0) + (p.alarm_count || 0);
    });
    Object.entries(byMachine).forEach(([m, count]) => console.log(`  ${m}: ${count} rolls`));
    
    const totalProduced = Object.values(byMachine).reduce((a, b) => a + b, 0);
    console.log(`  TOTAL MERAH produced today: ${totalProduced} rolls`);

    // 2. MERAH production in last 2 hours
    console.log(`\n=== MERAH production in last 2 hours (since ${twoHoursAgo}) ===`);
    const { data: recent } = await supabase
        .from('production_logs')
        .select('machine_id, alarm_count, created_at, lane_id')
        .ilike('product_sku', '%RED%')
        .gte('created_at', twoHoursAgo)
        .order('created_at', { ascending: false });

    let recentTotal = 0;
    recent?.forEach(p => { recentTotal += (p.alarm_count || 0); });
    console.log(`  Pulses in last 2h: ${recent?.length || 0}, Total rolls: ${recentTotal}`);

    // 3. Outgoing MERAH in sales_orders today
    console.log("\n=== MERAH dispatched via orders today ===");
    const { data: todayOrders } = await supabase
        .from('sales_orders')
        .select('order_number, status, items, driver_id, zone, created_at')
        .gte('created_at', today)
        .order('created_at', { ascending: false });

    let totalOut = 0;
    const driverIds = [...new Set((todayOrders || []).map(o => o.driver_id).filter(Boolean))];
    const { data: drivers } = await supabase.from('sys_users_v2').select('name, auth_user_id').in('auth_user_id', driverIds);
    const dm: Record<string, string> = {};
    drivers?.forEach(d => { if (d.auth_user_id) dm[d.auth_user_id] = d.name; });

    todayOrders?.forEach(o => {
        if (!Array.isArray(o.items)) return;
        o.items.filter((it: any) => (it.product || it.sku || it.name || '').toUpperCase().includes('MERAH')).forEach((it: any) => {
            const qty = it.quantity || it.qty || 0;
            totalOut += qty;
            console.log(`  [${o.order_number}] ${dm[o.driver_id] || '?'} | ${o.status} | MERAH x${qty} | ${o.zone}`);
        });
    });
    console.log(`  TOTAL MERAH out today: ${totalOut}`);

    // 4. Net stock change
    console.log(`\n=== Summary ===`);
    console.log(`  Produced today:  +${totalProduced}`);
    console.log(`  Dispatched today: -${totalOut}`);
    console.log(`  Net change:      ${totalProduced - totalOut >= 0 ? '+' : ''}${totalProduced - totalOut}`);
}

fullReport().catch(console.error);
