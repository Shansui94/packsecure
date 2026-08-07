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
        const res = await client.query(`
            SELECT plate_number FROM lorries;
        `);
        console.log("All plate numbers:");
        res.rows.forEach(r => console.log(`- "${r.plate_number}"`));
    } catch (e) {
        console.error("Error", e);
    } finally {
        await client.end();
    }
}

run();
