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

        const photoRes = await client.query(`
            SELECT id, user_id, created_at, photo_url, category, employee_name 
            FROM work_photos 
            WHERE created_at >= '2026-06-11T00:00:00+00:00'
            ORDER BY created_at DESC;
        `);

        console.log(`\nFound ${photoRes.rows.length} total records in work_photos since June 11:`);
        photoRes.rows.forEach(p => {
            console.log(`- ID: ${p.id} | Name: ${p.employee_name} | Cat: ${p.category} | Created: ${p.created_at}`);
            console.log(`  URL: ${p.photo_url}`);
            console.log(`-----------------------------------------------`);
        });

    } catch (e) {
        console.error("PG error", e);
    } finally {
        await client.end();
    }
}

run();
