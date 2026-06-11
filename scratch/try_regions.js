import pg from 'pg';
const { Client } = pg;

const regions = [
    'ap-southeast-1', // Singapore
    'ap-southeast-2', // Sydney
    'ap-northeast-1', // Tokyo
    'ap-northeast-2', // Seoul
    'us-east-1',      // N. Virginia
    'us-west-1',      // N. California
    'us-east-2',      // Ohio
    'eu-central-1',   // Frankfurt
    'eu-west-1',      // Ireland
    'eu-west-2',      // London
    'ca-central-1',   // Canada
    'sa-east-1',      // Sao Paulo
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
        if (e.message.includes('tenant/user') && e.message.includes('not found')) {
            // Tenant not found in this region
            console.log(`❌ Tenant not found in region: ${region}`);
        } else {
            console.log(`❓ Other error in region ${region}:`, e.message);
        }
        return false;
    }
}

async function run() {
    for (const region of regions) {
        const success = await testRegion(region);
        if (success) {
            break;
        }
    }
}

run();
