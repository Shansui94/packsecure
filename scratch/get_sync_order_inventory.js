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
        
        console.log("Fetching function definition for sync_order_inventory...");
        const res = await client.query(`
            SELECT proname, pg_get_functiondef(oid) as definition
            FROM pg_proc 
            WHERE proname = 'sync_order_inventory';
        `);
        
        if (res.rows.length === 0) {
            console.log("Function sync_order_inventory not found.");
        } else {
            console.log(res.rows[0].definition);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
