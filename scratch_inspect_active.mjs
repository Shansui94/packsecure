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
        console.log("Connected to PG successfully!");

        // Inspect columns of machine_active_products
        const colsRes = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'machine_active_products'
            ORDER BY ordinal_position;
        `);
        console.log("machine_active_products columns:");
        colsRes.rows.forEach(r => {
            console.log(`  ${r.column_name} (${r.data_type})`);
        });

        // Query active products currently in the database
        const activeRes = await client.query(`
            SELECT * FROM public.machine_active_products;
        `);
        console.log("Currently active products in DB:", activeRes.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
run();
