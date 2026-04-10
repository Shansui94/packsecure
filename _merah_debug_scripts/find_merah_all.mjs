import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findMissingMerah() {
    const merahSku = 'BW-SL-CLR-100Mx100CMx1ROLL-RED';
    
    // Fetch all sales orders from March 30
    const { data: orders } = await supabase.from('sales_orders')
        .select('order_number, driver_id, status, items')
        .gte('created_at', '2026-03-30T00:00:00.000Z')
        .neq('status', 'Cancelled');

    let total = 0;
    
    const { data: usersResponse } = await supabase.from('users_public').select('id, name');
    const usersMap = {};
    if (usersResponse) {
        usersResponse.forEach(u => usersMap[u.id] = (u.name || 'unassigned').toLowerCase());
    }

    let report = '=== ALL MERAH DOS ===\n';
    if (orders) {
        orders.forEach(o => {
            if (o.items) {
                o.items.forEach(item => {
                    if (item.sku === merahSku) {
                        const drvName = usersMap[o.driver_id] || 'unassigned/admin';
                        report += `[DO: ${o.order_number}] Status: ${o.status} | Driver: ${drvName} | Merah Qty: ${item.quantity}\n`;
                        total += Number(item.quantity) || 0;
                    }
                });
            }
        });
    }
    
    report += `\nTotal Merah in ALL DOs (since March 30): ${total}`;
    fs.writeFileSync('merah_all_output.txt', report);
}

findMissingMerah();
