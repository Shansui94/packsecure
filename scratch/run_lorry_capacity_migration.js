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

        console.log("Adding max_volume_m3 and max_weight_kg to public.lorries...");
        await client.query(`
            ALTER TABLE public.lorries 
            ADD COLUMN IF NOT EXISTS max_volume_m3 NUMERIC DEFAULT 36.8098,
            ADD COLUMN IF NOT EXISTS max_weight_kg NUMERIC DEFAULT 3000;
        `);
        console.log("Columns added successfully.");

        console.log("Updating capacity for VPC 9821 (65 rolls = 29.1785 m³)...");
        const resVpc = await client.query(`
            UPDATE public.lorries 
            SET max_volume_m3 = 29.1785 
            WHERE REPLACE(LOWER(plate_number), ' ', '') = 'vpc9821';
        `);
        console.log(`VPC updated: ${resVpc.rowCount} rows.`);

        console.log("Updating capacity for APH 9821 (92 rolls = 41.2988 m³)...");
        const resAph = await client.query(`
            UPDATE public.lorries 
            SET max_volume_m3 = 41.2988 
            WHERE REPLACE(LOWER(plate_number), ' ', '') = 'aph9821';
        `);
        console.log(`APH updated: ${resAph.rowCount} rows.`);

        // Verify values
        console.log("\nVerification:");
        const verifyRes = await client.query(`
            SELECT plate_number, max_volume_m3, max_weight_kg 
            FROM public.lorries 
            WHERE REPLACE(LOWER(plate_number), ' ', '') IN ('vpc9821', 'aph9821', 'dfk9821');
        `);
        verifyRes.rows.forEach(r => {
            console.log(`Lorry: ${r.plate_number} | Max Vol: ${r.max_volume_m3} | Max Wgt: ${r.max_weight_kg}`);
        });

    } catch (e) {
        console.error("Migration error", e);
    } finally {
        await client.end();
    }
}

run();
