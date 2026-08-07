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
        const colRes = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'lorries';
        `);
        console.log("Lorry columns:");
        colRes.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));

        const dataRes = await client.query(`
            SELECT * FROM lorries LIMIT 10;
        `);
        console.log("\nLorry data:");
        console.log(JSON.stringify(dataRes.rows, null, 2));
    } catch (e) {
        console.error("Error", e);
    } finally {
        await client.end();
    }
}

run();
