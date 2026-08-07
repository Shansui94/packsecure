import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    console.log("=== DIAGNOSTIC STOCK INFO FOR SL-25CM ===");

    // 1. Fetch inventory view for all matching SKUs
    console.log("\n--- 1. v2_inventory_view records for SL-25CM ---");
    const { data: invData, error: invErr } = await supabase
        .from('v2_inventory_view')
        .select('*')
        .or('sku.ilike.BW-SL-CLR-100Mx25CMx4ROLL%,sku.eq.SL-25CM');
        
    if (invErr) {
        console.error("Error fetching inv view:", invErr);
    } else {
        console.table(invData);
    }

    // 2. Fetch sales orders with relevant statuses
    console.log("\n--- 2. sales_orders (New, Production, Ready) containing SL-25CM ---");
    const { data: orderData, error: orderErr } = await supabase
        .from('sales_orders')
        .select('order_number, status, items')
        .in('status', ['New', 'Production', 'Ready']);

    if (orderErr) {
        console.error("Error fetching orders:", orderErr);
    } else {
        const matchingOrders = [];
        let totalReserved = 0;
        const reservedByLoc = {};

        orderData.forEach(order => {
            if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                    const sku = item.sku?.trim();
                    const qty = Number(item.quantity) || 0;
                    const loc = item.sourceLocation?.trim() || 'no location';
                    
                    if (sku && (sku.startsWith('BW-SL-CLR-100Mx25CMx4ROLL') || sku === 'SL-25CM')) {
                        matchingOrders.push({
                            order_number: order.order_number,
                            status: order.status,
                            sku,
                            quantity: qty,
                            sourceLocation: loc
                        });
                        totalReserved += qty;
                        reservedByLoc[loc] = (reservedByLoc[loc] || 0) + qty;
                    }
                });
            }
        });

        console.table(matchingOrders);
        console.log(`\nTotal reserved from orders: ${totalReserved}`);
        console.log("Reserved by Location:", reservedByLoc);
    }
}

run();
