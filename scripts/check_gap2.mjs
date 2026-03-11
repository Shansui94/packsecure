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
const headers = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` };

// 1. Production logs around gap
console.log('=== PRODUCTION LOGS 05:00-07:00 ===');
const logsResp = await fetch(
    `${SUPABASE_URL}/rest/v1/production_logs?machine_id=eq.${machineId}&created_at=gte.${today}T05:00:00%2B08:00&created_at=lte.${today}T07:00:00%2B08:00&order=created_at.asc&select=alarm_count,yield,product_sku,created_at&limit=50`,
    { headers }
);
const logs = await logsResp.json();
if (Array.isArray(logs)) {
    console.log(`Found ${logs.length} entries`);
    let lastTime = null;
    logs.forEach(l => {
        const t = new Date(l.created_at);
        const tStr = t.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour12: false });
        if (lastTime) {
            const gapMin = (t - lastTime) / 60000;
            if (gapMin > 5) console.log(`  *** GAP: ${gapMin.toFixed(1)} min ***`);
        }
        console.log(`  ${tStr} | count=${l.alarm_count} yield=${l.yield} sku=${l.product_sku}`);
        lastTime = t;
    });
} else {
    console.log('Error:', JSON.stringify(logs));
}

// 2. Check all today's logs to find the exact gap boundaries
console.log('\n=== ALL TODAY LOGS (time distribution) ===');
const allResp = await fetch(
    `${SUPABASE_URL}/rest/v1/production_logs?machine_id=eq.${machineId}&created_at=gte.${today}T00:00:00%2B08:00&order=created_at.asc&select=created_at,alarm_count&limit=200`,
    { headers }
);
const allLogs = await allResp.json();
if (Array.isArray(allLogs)) {
    console.log(`Total entries today: ${allLogs.length}`);
    let prev = null;
    allLogs.forEach(l => {
        const t = new Date(l.created_at);
        if (prev) {
            const gapMin = (t - prev) / 60000;
            if (gapMin > 3) {
                const prevStr = prev.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour12: false });
                const tStr = t.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour12: false });
                console.log(`  GAP: ${prevStr} → ${tStr} (${gapMin.toFixed(1)} min)`);
            }
        }
        prev = t;
    });
}
