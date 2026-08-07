import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Querying all sales_orders...");
    const { data: orders, error } = await supabase
        .from('sales_orders')
        .select('*');

    if (error) {
        console.error("Query failed:", error);
        return;
    }

    console.log(`Total orders fetched: ${orders.length}`);

    // Filter by Johor and Black Bubblewrap
    // Johor: zone is 'JOHOR' or delivery_address contains 'johor' (case insensitive)
    // Black Bubblewrap: SKU contains 'BLK' or 'BLACK', or product/remark contains 'HITAM', 'BLACK', '黑色'
    const filtered = orders.filter(o => {
        const isJohor = (o.zone && o.zone.toUpperCase().includes('JOHOR')) || 
                        (o.delivery_address && o.delivery_address.toLowerCase().includes('johor')) ||
                        (o.trip_origin && o.trip_origin.toUpperCase().includes('JOHOR'));
        
        if (!isJohor) return false;

        const hasBlackBubblewrap = o.items && o.items.some(item => {
            const sku = (item.sku || '').toLowerCase();
            const product = (item.product || '').toLowerCase();
            const remark = (item.remark || '').toLowerCase();

            return sku.includes('blk') || sku.includes('black') || 
                   product.includes('hitam') || product.includes('black') || product.includes('黑色') ||
                   remark.includes('hitam') || remark.includes('black') || remark.includes('黑色');
        });

        return hasBlackBubblewrap;
    });

    console.log(`\nFiltered ${filtered.length} Johor Black Bubblewrap orders:`);
    filtered.forEach((o, index) => {
        console.log(`\n${index + 1}. Order: ${o.order_number}`);
        console.log(`   Customer: ${o.customer}`);
        console.log(`   Delivery Date: ${o.deadline || o.order_date}`);
        console.log(`   Status: ${o.status}`);
        console.log(`   Zone/Address: ${o.zone} / ${o.delivery_address}`);
        console.log(`   Items:`);
        o.items.forEach(item => {
            console.log(`      - Product: "${item.product}", SKU: "${item.sku}", Qty: ${item.quantity}, Remark: "${item.remark}"`);
        });
    });
}

run();
