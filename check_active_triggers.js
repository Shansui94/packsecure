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
        
        console.log("--- Active triggers on sales_orders ---");
        const res = await client.query(`
            SELECT tgname, pg_get_triggerdef(oid) as def
            FROM pg_trigger 
            WHERE tgrelid = 'public.sales_orders'::regclass AND NOT tgisinternal;
        `);
        res.rows.forEach(r => {
            console.log(`Trigger: ${r.tgname}`);
            console.log(`Definition: ${r.def}\n`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
