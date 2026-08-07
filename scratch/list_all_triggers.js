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
        
        console.log("=== ALL TRIGGERS IN DATABASE ===");
        const res = await client.query(`
            SELECT 
                tgname as trigger_name,
                relname as table_name,
                pg_get_triggerdef(pg_trigger.oid) as trigger_definition
            FROM pg_trigger 
            JOIN pg_class ON pg_class.oid = tgrelid
            WHERE NOT tgisinternal;
        `);
        console.log(`Found ${res.rows.length} triggers.`);
        res.rows.forEach(r => {
            console.log(`Table: ${r.table_name} | Trigger: ${r.trigger_name}`);
            console.log(`Definition: ${r.trigger_definition}\n`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
