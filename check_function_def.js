import pg from 'pg';
const { Client } = pg;

const config = {
    user: 'postgres.kdahubyhwndgyloaljak',
    password: '$QNQ4rAW*#%294z',
    host: 'aws-1-ap-south-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
};

async function run() {
    const client = new Client(config);
    try {
        await client.connect();
        
        console.log("--- SQL Function Definition: sync_order_inventory ---");
        const res = await client.query(`
            SELECT prosrc 
            FROM pg_proc 
            WHERE proname = 'sync_order_inventory';
        `);
        console.log(res.rows[0].prosrc);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
