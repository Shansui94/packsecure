import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function deepSearch() {
    const deanUID = 'c3eeab28-5960-4bef-b5d3-28d69dfa0b5d';
    const ameerUID = 'd7316083-f889-47ca-a258-c7b5175891dc';

    // The user says the originals were CREATED yesterday (March 25).
    // Yesterday in UTC = 2026-03-25T00:00:00 to 2026-03-25T23:59:59
    // Malaysia time (UTC+8): Mar 25 midnight = Mar 24 16:00 UTC, Mar 25 23:59 = Mar 25 15:59 UTC
    
    console.log("=== ALL orders created on March 25 (UTC) for Dean & Ameer ===");
    const { data: yesterdayCreated } = await supabase
        .from('sales_orders')
        .select('id, order_number, status, order_date, driver_id, zone, items, created_at, customer')
        .in('driver_id', [deanUID, ameerUID])
        .gte('created_at', '2026-03-24T16:00:00+00:00') // Mar 25 00:00 MYT
        .lt('created_at', '2026-03-25T16:00:00+00:00')   // Mar 25 23:59 MYT
        .order('created_at', { ascending: false });

    console.log(`  Found ${yesterdayCreated?.length || 0} orders:`);
    yesterdayCreated?.forEach((o, i) => {
        const driver = o.driver_id === deanUID ? 'Dean' : 'Ameer';
        const itemSummary = Array.isArray(o.items)
            ? o.items.map((it: any) => `${it.product || it.sku || it.name || '?'}x${it.quantity || it.qty || '?'}`).join(', ')
            : JSON.stringify(o.items)?.substring(0, 100);
        console.log(`  ${i+1}. [${o.order_number}] ${driver} | OrderDate: ${o.order_date} | Status: ${o.status} | Zone: ${o.zone || 'null'} | Created: ${o.created_at}`);
        console.log(`     Items: ${itemSummary}`);
    });

    // Also search ALL orders created yesterday regardless of driver (maybe Vivian assigned to wrong driver or no driver)
    console.log("\n=== ALL orders created on March 25 (MYT) with matching products ===");
    const { data: allYesterday } = await supabase
        .from('sales_orders')
        .select('id, order_number, status, order_date, driver_id, zone, items, created_at, customer')
        .gte('created_at', '2026-03-24T16:00:00+00:00')
        .lt('created_at', '2026-03-25T16:00:00+00:00')
        .order('created_at', { ascending: false });

    // Get driver names for all
    const allDriverIds = [...new Set((allYesterday || []).map(o => o.driver_id).filter(Boolean))];
    const { data: drivers } = await supabase.from('sys_users_v2').select('name, auth_user_id').in('auth_user_id', allDriverIds);
    const driverMap: Record<string, string> = {};
    drivers?.forEach(d => { if (d.auth_user_id) driverMap[d.auth_user_id] = d.name; });

    console.log(`  Found ${allYesterday?.length || 0} total orders created yesterday:`);
    allYesterday?.forEach((o, i) => {
        const driver = driverMap[o.driver_id] || o.driver_id?.substring(0, 8) || 'NO DRIVER';
        const itemSummary = Array.isArray(o.items)
            ? o.items.map((it: any) => `${it.product || it.sku || it.name || '?'}x${it.quantity || it.qty || '?'}`).join(', ')
            : JSON.stringify(o.items)?.substring(0, 100);
        console.log(`  ${i+1}. [${o.order_number}] ${driver} | Date: ${o.order_date} | Status: ${o.status} | Zone: ${o.zone || 'null'}`);
        console.log(`     Items: ${itemSummary}`);
    });

    // Specifically look for MERAH, OREN, HITAM-33CM in yesterday's orders
    console.log("\n=== Searching for MERAH/OREN/HITAM-33CM specifically ===");
    const targetProducts = ['MERAH', 'OREN', 'HITAM-33CM'];
    allYesterday?.forEach((o) => {
        if (!Array.isArray(o.items)) return;
        const matchedItems = o.items.filter((it: any) => {
            const name = (it.product || it.sku || it.name || '').toUpperCase();
            return targetProducts.some(t => name.includes(t));
        });
        if (matchedItems.length > 0) {
            const driver = driverMap[o.driver_id] || o.driver_id?.substring(0, 8) || 'NO DRIVER';
            console.log(`  🎯 [${o.order_number}] ${driver} | Status: ${o.status} | Zone: ${o.zone || 'null'}`);
            matchedItems.forEach((it: any) => {
                console.log(`     → ${it.product || it.sku || it.name} x ${it.quantity || it.qty}`);
            });
        }
    });
}

deepSearch().catch(console.error);
