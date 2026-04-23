const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:packsecure2024@db.kdahubyhwndgyloaljak.supabase.co:5432/postgres' // Wait, I don't know the password...
});

async function run() {
    await client.connect();
    const res = await client.query(`
        SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'production_logs_v2';
    `);
    console.log("Realtime enabled?", res.rows);
    if (res.rows.length === 0) {
        console.log("Adding production_logs_v2 to Realtime...");
        await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE production_logs_v2;`);
        console.log("Done.");
    }
    await client.end();
}
// run().catch(console.error);
