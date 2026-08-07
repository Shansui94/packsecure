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

        // Fetch latest 15 sales orders
        const res = await client.query(`
            SELECT 
                so.id,
                so.order_number,
                so.status,
                so.customer,
                so.trip_origin,
                so.order_date,
                so.created_at,
                so.driver_id,
                u.name as driver_name,
                u.email as driver_email,
                so.pod_photo_url,
                so.proof_of_load_url
            FROM sales_orders so
            LEFT JOIN users_public u ON so.driver_id = u.id
            ORDER BY so.created_at DESC
            LIMIT 15;
        `);

        console.log(`\n=== Latest 15 Sales Orders ===`);
        res.rows.forEach(o => {
            const photos = o.pod_photo_url ? o.pod_photo_url.split(',') : [];
            const doPhoto = photos[0] || '';
            const prodPhoto = photos[1] || '';
            console.log(`- Order No: ${o.order_number}`);
            console.log(`  Driver: ${o.driver_name || 'N/A'} (${o.driver_email || 'N/A'})`);
            console.log(`  Status: ${o.status}`);
            console.log(`  Order Date: ${o.order_date}`);
            console.log(`  Created At: ${o.created_at}`);
            console.log(`  DO Photo: ${doPhoto ? 'UPLOADED' : 'MISSING'}`);
            console.log(`  Product Photo: ${prodPhoto ? 'UPLOADED' : 'MISSING'}`);
            console.log(`  Full pod_photo_url: ${o.pod_photo_url || 'empty'}`);
            console.log(`-----------------------------------------------`);
        });

    } catch (e) {
        console.error("PG error", e);
    } finally {
        await client.end();
    }
}

run();
