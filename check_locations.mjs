import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkOrders() {
    const { data: o, error } = await supabaseAdmin.from('sales_orders').select('id, items, delivery_address, zone, order_date, deadline').neq('status', 'Delivered').neq('status', 'Cancelled').limit(50);
    console.log("Found orders:", o?.length, error);
    if (o) {
        let opmLamaCount = 0;
        let opmCornerCount = 0;
        let nilaiCount = 0;
        let spdCount = 0;

        o.forEach(ord => {
            const text = ord.items.map((i) => (i.remark || '') + ' ' + (i.sourceLocation || '')).join(' ').toLowerCase();
            const orderText = ((ord.zone || '') + ' ' + (ord.delivery_address || '')).toLowerCase();

            if (text.includes('opm lama')) opmLamaCount++;
            else if (text.includes('opm corner')) opmCornerCount++;
            else if (text.includes('nilai') || orderText.includes('nilai') || orderText.includes('seremban')) nilaiCount++;
            else spdCount++;

            console.log("Order:", ord.id, "Tab:", text.includes('opm lama') ? 'OPM Lama' : text.includes('opm corner') ? 'OPM Corner' : 'SPD');
            console.log("Text:", text);
        })
        console.log(`\nStats: OPM Lama=${opmLamaCount}, OPM Corner=${opmCornerCount}, Nilai=${nilaiCount}, SPD=${spdCount}`);
    }
}
checkOrders();
