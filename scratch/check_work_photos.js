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

        // Query work_photos uploaded by Taufik's user_id or containing Taufik in name/url
        const photoRes = await client.query(`
            SELECT id, user_id, created_at, photo_url, category, employee_name 
            FROM work_photos 
            WHERE (user_id = '33309909-7102-41da-adc7-44606fdcb09a' 
               OR photo_url ILIKE '%Taufik%' 
               OR employee_name ILIKE '%Taufik%')
              AND created_at >= '2026-06-11T00:00:00+00:00'
            ORDER BY created_at DESC;
        `);

        console.log(`\nFound ${photoRes.rows.length} records in work_photos since June 11 for Taufik:`);
        photoRes.rows.forEach(p => {
            console.log(`- ID: ${p.id}`);
            console.log(`  User ID: ${p.user_id}`);
            console.log(`  Employee Name: ${p.employee_name}`);
            console.log(`  Category: ${p.category}`);
            console.log(`  Photo URL: ${p.photo_url}`);
            console.log(`  Created At: ${p.created_at}`);
            console.log(`-----------------------------------------------`);
        });

    } catch (e) {
        console.error("PG error", e);
    } finally {
        await client.end();
    }
}

run();
