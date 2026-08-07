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

        // Fetch all active/uncompleted orders that have photos
        const res = await client.query(`
            SELECT 
                so.id,
                so.order_number,
                so.status,
                so.customer,
                so.created_at,
                so.order_date,
                so.deadline,
                u.name as driver_name,
                u.email as driver_email,
                so.pod_photo_url,
                so.notes
            FROM sales_orders so
            LEFT JOIN users_public u ON so.driver_id = u.id
            WHERE so.status NOT IN ('Delivered', 'Cancelled', 'tamat')
              AND so.pod_photo_url IS NOT NULL
              AND TRIM(so.pod_photo_url) != ''
              AND TRIM(so.pod_photo_url) != ','
            ORDER BY so.created_at DESC;
        `);

        console.log(`\nFound ${res.rows.length} uncompleted orders with photos:`);
        console.log(`========================================================================================================================`);
        res.rows.forEach(o => {
            const dateStr = o.created_at ? o.created_at.toISOString().split('T')[0] : 'N/A';
            const orderDateStr = o.order_date ? new Date(o.order_date).toISOString().split('T')[0] : 'N/A';
            const photosCount = o.pod_photo_url ? o.pod_photo_url.split(',').length : 0;
            
            console.log(`Order: ${o.order_number.padEnd(25)} | Driver: ${(o.driver_name || 'N/A').padEnd(10)} | Status: ${o.status.padEnd(10)} | Created: ${dateStr} | OrderDate: ${orderDateStr} | PhotosCount: ${photosCount} | Notes: ${o.notes || 'none'}`);
        });
        console.log(`========================================================================================================================`);

    } catch (e) {
        console.error("PG error", e);
    } finally {
        await client.end();
    }
}

run();
