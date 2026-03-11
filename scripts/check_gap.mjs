import { readFileSync } from 'fs';
const envContent = readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0 && !line.startsWith('#')) {
        env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
}
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const machineId = 'T1.3-M02';
const today = '2026-03-08';

// 1. Check production_logs around the gap
console.log('=== PRODUCTION LOGS around gap (05:00 - 07:00) ===');
const logsResp = await fetch(
    `${SUPABASE_URL}/rest/v1/production_logs?machine_id=eq.${machineId}&created_at=gte.${today}T05:00:00+08:00&created_at=lte.${today}T07:00:00+08:00&order=created_at.asc&select=id,machine_id,alarm_count,yield,product_sku,created_at`,
    { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
);
const logs = await logsResp.json();
console.log(`Found ${logs.length} log entries:`);
logs.forEach(l => {
    const t = new Date(l.created_at).toLocaleTimeString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' });
    console.log(`  ${t} | count=${l.alarm_count} yield=${l.yield} sku=${l.product_sku}`);
});

// 2. Check heartbeats
console.log('\n=== HEARTBEATS around gap (05:00 - 07:00) ===');
const hbResp = await fetch(
    `${SUPABASE_URL}/rest/v1/machine_heartbeats?machine_id=eq.${machineId}&last_seen=gte.${today}T05:00:00+08:00&last_seen=lte.${today}T07:00:00+08:00&order=last_seen.asc&select=machine_id,last_seen,firmware_version,wifi_rssi,free_heap`,
    { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
);
const hbs = await hbResp.json();
if (Array.isArray(hbs)) {
    console.log(`Found ${hbs.length} heartbeats`);
    hbs.forEach(h => {
        const t = new Date(h.last_seen).toLocaleTimeString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' });
        console.log(`  ${t} | rssi=${h.wifi_rssi} heap=${h.free_heap} fw=${h.firmware_version}`);
    });
} else {
    console.log('Heartbeat response:', JSON.stringify(hbs));
}

// 3. Check if machine_heartbeats stores differently (single row upsert)
console.log('\n=== Current heartbeat state ===');
const curResp = await fetch(
    `${SUPABASE_URL}/rest/v1/machine_heartbeats?machine_id=eq.${machineId}&select=*`,
    { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
);
const cur = await curResp.json();
console.log(JSON.stringify(cur, null, 2));
