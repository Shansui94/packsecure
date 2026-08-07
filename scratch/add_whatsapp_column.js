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
        console.log("Connected to database successfully!");

        // Add whatsapp_screenshot_url column to sales_orders if not exists
        await client.query(`
            ALTER TABLE public.sales_orders 
            ADD COLUMN IF NOT EXISTS whatsapp_screenshot_url TEXT;
        `);
        console.log("SUCCESS: whatsapp_screenshot_url column added to sales_orders table.");

        // Query the table columns again to verify
        const res = await client.query("SELECT * FROM public.sales_orders LIMIT 1;");
        if (res.rows.length > 0 || res.fields.length > 0) {
            const columns = res.fields.map(f => f.name);
            console.log("Current columns on sales_orders:", columns);
        }
    } catch (e) {
        console.error("Database migration error:", e);
    } finally {
        await client.end();
    }
}

run();
