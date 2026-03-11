import { readFileSync } from 'fs';
const envContent = readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0 && !line.startsWith('#')) {
        env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
}

// Call the iot-config endpoint for T1.3-M02's MAC
const mac = 'F4:2D:C9:87:E1:74';
const url = `https://packsecure.vercel.app/api/iot-config?mac=${encodeURIComponent(mac)}`;
console.log('Calling:', url);
const resp = await fetch(url);
const data = await resp.json();
console.log('IoT Config Response:', JSON.stringify(data, null, 2));
