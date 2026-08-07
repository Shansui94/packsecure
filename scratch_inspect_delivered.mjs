import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const determineState = (address) => {
    if (!address) return 'Other';
    const lowerAddr = address.toLowerCase();

    if (lowerAddr.includes('johor') || lowerAddr.includes('jb') || lowerAddr.includes('skudai') || lowerAddr.includes('pasir gudang')) return 'Johor';
    if (lowerAddr.includes('penang') || lowerAddr.includes('pulau pinang') || lowerAddr.includes('georgetown') || lowerAddr.includes('butterworth')) return 'Penang';
    if (lowerAddr.includes('kuala lumpur') || lowerAddr.includes('kl ') || lowerAddr.includes('klang valley') || lowerAddr.includes('wilayah persekutuan') || lowerAddr.endsWith(' kl') || lowerAddr.includes(',kl') || lowerAddr.includes(' kl,')) return 'K. Lumpur';
    if (lowerAddr.includes('selangor') || lowerAddr.includes('shah alam') || lowerAddr.includes('petaling jaya') || lowerAddr.includes('klang') || lowerAddr.includes('kajang') || lowerAddr.includes('rawang') || lowerAddr.includes('semenyih')) return 'Selangor';
    if (lowerAddr.includes('melaka') || lowerAddr.includes('malacca')) return 'Melaka';
    if (lowerAddr.includes('negeri sembilan') || lowerAddr.includes('seremban') || lowerAddr.includes('nilai')) return 'N. Sembilan';
    if (lowerAddr.includes('perak') || lowerAddr.includes('ipoh') || lowerAddr.includes('taiping')) return 'Perak';
    if (lowerAddr.includes('kedah') || lowerAddr.includes('kulim') || lowerAddr.includes('sungai petani')) return 'Kedah';
    if (lowerAddr.includes('pahang') || lowerAddr.includes('kuantan')) return 'Pahang';
    if (lowerAddr.includes('terengganu')) return 'Terengganu';
    if (lowerAddr.includes('kelantan') || lowerAddr.includes('kota bharu') || lowerAddr.includes('rantau panjang')) return 'Kelantan';
    if (lowerAddr.includes('perlis')) return 'Perlis';
    if (lowerAddr.includes('sabah')) return 'Sabah';
    if (lowerAddr.includes('sarawak')) return 'Sarawak';

    // Fallback based on typical Central area if no state found
    if (lowerAddr.includes('puchong') || lowerAddr.includes('bangi') || lowerAddr.includes('cyberjaya')) return 'Selangor';
    if (lowerAddr.includes('cheras')) return 'K. Lumpur';

    return 'Other';
};

async function inspect() {
    const { data: orders, error } = await supabaseAdmin
        .from('sales_orders')
        .select('id, order_number, driver_id, order_date, deadline, zone, delivery_address, items')
        .eq('status', 'Delivered')
        .gte('order_date', '2026-05-01')
        .lte('order_date', '2026-05-31');

    if (error) {
        console.error("Error fetching orders:", error);
        return;
    }

    console.log(`Fetched ${orders.length} delivered orders for May 2026.`);

    // Grouping structure: { [state]: { tripKeys: Set, totalDOs: 0, totalRolls: 0 } }
    const stateData = {};

    orders.forEach(o => {
        const addr = o.delivery_address || '';
        const zone = o.zone || '';
        const state = determineState(`${addr} ${zone}`.trim());
        const date = o.order_date || o.deadline || 'no-date';
        const driver = o.driver_id || 'no-driver';
        
        // Trip grouping key: driver + date + state
        const tripKey = `${driver}_${date}_${state}`;

        if (!stateData[state]) {
            stateData[state] = {
                tripKeys: new Set(),
                totalDOs: 0,
                totalRolls: 0
            };
        }

        stateData[state].tripKeys.add(tripKey);
        stateData[state].totalDOs += 1;

        // Calculate rolls
        let rolls = 0;
        const items = o.items || [];
        items.forEach(item => {
            rolls += Number(item.quantity) || 0;
        });
        stateData[state].totalRolls += rolls;
    });

    console.log("\nMay 2026 Trips by State Report:");
    const table = Object.entries(stateData).map(([state, data]) => ({
        State: state,
        'Trip Days (趟数)': data.tripKeys.size,
        'DOs (单数)': data.totalDOs,
        'Rolls (卷数)': data.totalRolls
    })).sort((a, b) => b['Trip Days (趟数)'] - a['Trip Days (趟数)']);

    console.table(table);
}

inspect();
