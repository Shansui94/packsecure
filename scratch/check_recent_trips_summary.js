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
        console.log("Connected to PG database successfully!");

        const res = await client.query(`
            SELECT 
                so.order_number,
                so.status,
                so.customer,
                so.trip_origin,
                so.order_date,
                so.created_at,
                u.name as driver_name,
                u.email as driver_email,
                so.pod_photo_url,
                so.proof_of_load_url
            FROM sales_orders so
            LEFT JOIN users_public u ON so.driver_id = u.id
            WHERE so.created_at >= '2026-06-11T00:00:00+00:00'
            ORDER BY so.created_at DESC;
        `);

        console.log(`\nFound ${res.rows.length} orders since June 11, 2026:`);
        console.log(`======================================================================`);
        res.rows.forEach(o => {
            const photos = o.pod_photo_url ? o.pod_photo_url.split(',') : [];
            const doPhoto = photos[0] ? 'Yes' : 'No';
            const prodPhoto = photos[1] ? 'Yes' : 'No';
            const loadPhoto = o.proof_of_load_url ? 'Yes' : 'No';
            
            console.log(`Order: ${o.order_number.padEnd(25)} | Driver: ${(o.driver_name || 'N/A').padEnd(10)} | Status: ${o.status.padEnd(10)} | Load: ${loadPhoto} | DO: ${doPhoto} | Prod: ${prodPhoto} | Created: ${o.created_at.toISOString()}`);
        });
        console.log(`======================================================================`);

    } catch (e) {
        console.error("PG error", e);
    } finally {
        await client.end();
    }
}

run();
