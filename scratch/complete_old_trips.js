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

        // 1. Identify orders created BEFORE 2026-06-12 that are uncompleted but have photos
        const findOldRes = await client.query(`
            SELECT 
                so.id,
                so.order_number,
                so.status,
                so.created_at,
                u.name as driver_name,
                so.pod_photo_url
            FROM sales_orders so
            LEFT JOIN users_public u ON so.driver_id = u.id
            WHERE so.status NOT IN ('Delivered', 'Cancelled', 'tamat')
              AND so.created_at < '2026-06-12T00:00:00+00:00'
              AND so.pod_photo_url IS NOT NULL
              AND TRIM(so.pod_photo_url) != ''
              AND TRIM(so.pod_photo_url) != ','
            ORDER BY so.created_at DESC;
        `);

        console.log(`\nFound ${findOldRes.rows.length} old trips (before June 12) with photos that need to be completed:`);
        findOldRes.rows.forEach(o => {
            console.log(`- Order: ${o.order_number} | Driver: ${o.driver_name} | Created: ${o.created_at.toISOString()}`);
        });

        if (findOldRes.rows.length > 0) {
            const idsToUpdate = findOldRes.rows.map(o => o.id);
            // Update them to 'Delivered'
            const updateRes = await client.query(`
                UPDATE sales_orders 
                SET status = 'Delivered', pod_timestamp = NOW() 
                WHERE id = ANY($1::uuid[])
                RETURNING id, order_number, status;
            `, [idsToUpdate]);

            console.log(`\nSuccessfully marked ${updateRes.rows.length} old trips as Completed (Delivered)!`);
        } else {
            console.log("\nNo old trips with photos found to update.");
        }

        // 2. Print today's/yesterday's trips (created on or after 2026-06-12) that we did NOT touch
        const findNewRes = await client.query(`
            SELECT 
                so.order_number,
                so.status,
                so.created_at,
                u.name as driver_name,
                so.pod_photo_url,
                so.notes
            FROM sales_orders so
            LEFT JOIN users_public u ON so.driver_id = u.id
            WHERE so.status NOT IN ('Delivered', 'Cancelled', 'tamat')
              AND so.created_at >= '2026-06-12T00:00:00+00:00'
              AND so.pod_photo_url IS NOT NULL
              AND TRIM(so.pod_photo_url) != ''
              AND TRIM(so.pod_photo_url) != ','
            ORDER BY so.created_at DESC;
        `);

        console.log(`\n=== Active Today's Trips (Created >= June 12) left UNTOUCHED ===`);
        findNewRes.rows.forEach(o => {
            console.log(`- Order: ${o.order_number} | Driver: ${o.driver_name} | Status: ${o.status} | Created: ${o.created_at.toISOString()}`);
            console.log(`  Notes: ${o.notes}`);
        });

    } catch (e) {
        console.error("PG error", e);
    } finally {
        await client.end();
    }
}

run();
