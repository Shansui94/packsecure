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
                so.created_at,
                u.name as driver_name,
                u.email as driver_email,
                so.pod_photo_url,
                so.proof_of_load_url,
                so.notes
            FROM sales_orders so
            LEFT JOIN users_public u ON so.driver_id = u.id
            WHERE so.created_at >= '2026-06-11T00:00:00+00:00'
              AND so.status = 'Delivered'
            ORDER BY so.created_at DESC;
        `);

        console.log(`\n=== Delivered Orders since June 11 ===`);
        let count = 0;
        res.rows.forEach(o => {
            const photos = o.pod_photo_url ? o.pod_photo_url.split(',').map(p => p.trim()).filter(Boolean) : [];
            const hasPhotos = photos.length > 0;
            if (!hasPhotos) {
                count++;
                console.log(`Order: ${o.order_number} | Driver: ${o.driver_name} | Notes: ${o.notes}`);
                console.log(`  Created: ${o.created_at.toISOString()}`);
                console.log(`  POD Photo URL: ${o.pod_photo_url}`);
                console.log(`-----------------------------------------------`);
            }
        });
        console.log(`Found ${count} Delivered orders with missing photos.`);

    } catch (e) {
        console.error("PG error", e);
    } finally {
        await client.end();
    }
}

run();
