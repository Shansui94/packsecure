import pg from 'pg';
const { Client } = pg;

async function testCluster(clusterNum) {
    const host = `${clusterNum}-ap-south-1.pooler.supabase.com`;
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
        console.log(`✅ Success with cluster: ${clusterNum} (Host: ${host})`);
        await client.end();
        return true;
    } catch (e) {
        console.log(`Cluster ${clusterNum} (${host}): ${e.message}`);
        return false;
    }
}

async function run() {
    const clusters = ['aws-0', 'aws-1', 'aws-2', 'aws-3', 'aws-4'];
    for (const c of clusters) {
        const success = await testCluster(c);
        if (success) {
            break;
        }
    }
}

run();
