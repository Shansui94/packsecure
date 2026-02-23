// Check IoT device status from Supabase
// Usage: node scripts/check_iot.cjs

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    console.log('📡 Fetching IoT device configs...\n');

    const { data: devices, error } = await supabase
        .from('iot_device_configs')
        .select('*')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    if (!devices || devices.length === 0) {
        console.log('⚠️  No IoT devices registered in the database.');
        return;
    }

    const now = Date.now();
    devices.forEach(d => {
        const diff = d.last_heartbeat ? now - new Date(d.last_heartbeat).getTime() : Infinity;
        const status = diff < 300000 ? '🟢 ONLINE' : '🔴 OFFLINE';
        const lastSeen = d.last_heartbeat
            ? `${Math.round(diff / 60000)} mins ago (${new Date(d.last_heartbeat).toLocaleString()})`
            : 'Never';

        console.log(`${status} | MAC: ${d.mac_address}`);
        console.log(`   Machine: ${d.machine_id || 'Unassigned'} | Lane: ${d.lane_id || '-'}`);
        console.log(`   SKU: ${d.active_product_sku || '-'} | Cut: ${d.cutting_size || '-'}cm | Debounce: ${d.debounce_ms || '-'}ms`);
        console.log(`   Firmware: ${d.firmware_version || '-'} | Last Seen: ${lastSeen}`);
        console.log(`   Notes: ${d.notes || '-'}`);
        console.log('');
    });

    console.log(`Total devices: ${devices.length}`);
    const online = devices.filter(d => {
        const diff = d.last_heartbeat ? now - new Date(d.last_heartbeat).getTime() : Infinity;
        return diff < 300000;
    }).length;
    console.log(`🟢 Online: ${online} | 🔴 Offline: ${devices.length - online}`);
}

main().catch(console.error);
