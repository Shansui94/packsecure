import pkg from 'pg';
const { Client } = pkg;

const connectionString = 'postgresql://postgres.kdahubyhwndgyloaljak:%24QNQ4rAW*%23%25294z@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';

async function main() {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await client.connect();
    console.log("Connected to Supabase Postgres Pooler.");

    // Add leave_type column if not exists
    await client.query(`ALTER TABLE public.employee_leave ADD COLUMN IF NOT EXISTS leave_type TEXT;`);
    console.log("✅ ALTER TABLE employee_leave ADD COLUMN IF NOT EXISTS leave_type TEXT succeeded!");

    // Backfill leave_type based on existing reason
    const updateRes = await client.query(`
        UPDATE public.employee_leave 
        SET leave_type = CASE 
            WHEN lower(reason) LIKE '%annual%' OR lower(reason) LIKE '%tahunan%' OR lower(reason) LIKE '%年假%' OR lower(reason) = 'al' OR lower(reason) LIKE '% al%' THEN 'Annual'
            WHEN lower(reason) LIKE '%mc%' OR lower(reason) LIKE '%medical%' OR lower(reason) LIKE '%sakit%' OR lower(reason) LIKE '%demam%' OR lower(reason) LIKE '%hospital%' OR lower(reason) LIKE '%doctor%' OR lower(reason) LIKE '%doktor%' OR lower(reason) LIKE '%warded%' OR lower(reason) LIKE '%discharge%' OR lower(reason) LIKE '%checkup%' OR lower(reason) LIKE '%fisio%' THEN 'Medical'
            WHEN lower(reason) LIKE '%emergency%' OR lower(reason) LIKE '%kecemasan%' OR lower(reason) LIKE '%hal keluarga%' OR lower(reason) LIKE '%urusan keluarga%' OR lower(reason) LIKE '%family event%' OR lower(reason) LIKE '%kahwin%' OR lower(reason) LIKE '%nikah%' THEN 'Emergency'
            WHEN lower(reason) LIKE '%off day%' OR lower(reason) LIKE '%rehat%' OR lower(reason) LIKE '%cuti rehat%' THEN 'Off Day'
            WHEN lower(reason) LIKE '%unpaid%' OR lower(reason) LIKE '%tanpa gaji%' THEN 'Unpaid'
            WHEN lower(reason) LIKE '%ganti%' OR lower(reason) LIKE '%ph%' THEN 'PH Replacement'
            ELSE 'Annual'
        END
        WHERE leave_type IS NULL;
    `);
    console.log(`✅ Backfilled ${updateRes.rowCount} existing leaves with leave_type!`);

    // Verify
    const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'employee_leave';
    `);
    console.log("Current columns of employee_leave:", res.rows.map(r => `${r.column_name} (${r.data_type})`));

    // Show sample updated rows
    const sample = await client.query(`
        SELECT id, start_date, count_days, reason, leave_type, status 
        FROM public.employee_leave 
        ORDER BY created_at DESC 
        LIMIT 10;
    `);
    console.log("Sample rows with leave_type:", sample.rows);

    await client.end();
}

main().catch(err => {
    console.error("Migration error:", err);
    process.exit(1);
});
