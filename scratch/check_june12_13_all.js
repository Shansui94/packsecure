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

        // Fetch all sales orders since June 12
        const res = await client.query(`
            SELECT 
                so.order_number,
                so.status,
                so.customer,
                so.trip_origin,
                so.created_at,
                so.order_date,
                so.deadline,
                u.name as driver_name,
                so.pod_photo_url,
                so.proof_of_load_url,
                so.notes
            FROM sales_orders so
            LEFT JOIN users_public u ON so.driver_id = u.id
            WHERE so.created_at >= '2026-06-12T00:00:00+00:00'
            ORDER BY so.created_at DESC;
        `);

        console.log(`\nFound ${res.rows.length} total orders created since June 12, 2026:`);
        console.log(`========================================================================================================================`);
        res.rows.forEach(o => {
            const dateStr = o.created_at ? o.created_at.toISOString() : 'N/A';
            const orderDateStr = o.order_date ? new Date(o.order_date).toISOString().split('T')[0] : 'N/A';
            const hasPod = o.pod_photo_url && o.pod_photo_url.trim() !== '' && o.pod_photo_url.trim() !== ',' ? 'Yes' : 'No';
            const hasLoad = o.proof_of_load_url ? 'Yes' : 'No';
            
            console.log(`Order: ${o.order_number.padEnd(25)} | Driver: ${(o.driver_name || 'N/A').padEnd(10)} | Status: ${o.status.padEnd(10)} | LoadPhoto: ${hasLoad} | UnloadPhotos: ${hasPod} | OrderDate: ${orderDateStr} | Created: ${dateStr}`);
        });
        console.log(`========================================================================================================================`);

    } catch (e) {
        console.error("PG error", e);
    } finally {
        await client.end();
    }
}

run();
