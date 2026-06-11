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
        
        console.log("--- Unique Sales Order Statuses ---");
        const res = await client.query(`
            SELECT status, COUNT(*) 
            FROM public.sales_orders 
            GROUP BY status
        `);
        console.log(res.rows);

        console.log("\n--- Checking columns in sales_orders ---");
        const cols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'sales_orders' AND table_schema = 'public'
        `);
        cols.rows.forEach(c => console.log(`- ${c.column_name}: ${c.data_type}`));

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
