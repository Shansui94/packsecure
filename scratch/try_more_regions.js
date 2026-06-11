import pg from 'pg';
const { Client } = pg;

const regions = [
    'us-west-2',      // Oregon
    'ap-south-1',      // Mumbai
    'ap-southeast-3',  // Jakarta
    'eu-west-3',       // Paris
    'ap-southeast-1'   // Retrying Singapore just in case
];

async function testRegion(region) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const config = {
        user: 'postgres.kdahubyhwndgyloaljak',
        password: '$QNQ4rAW*#%294z',
        host: host,
        port: 6543,
        database: 'postgres',
        ssl: { rejectUnauthorized: false }
    };
    const client = new Client(config);
    try {
        await client.connect();
        console.log(`✅ Success in region: ${region} (Host: ${host})`);
        await client.end();
        return true;
    } catch (e) {
        console.log(`Region ${region}: ${e.message}`);
        return false;
    }
}

async function run() {
    for (const region of regions) {
        await testRegion(region);
    }
}

run();
