import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
    connectionString: `postgresql://postgres:${encodeURIComponent('$QNQ4rAW*#%294z')}@db.kdahubyhwndgyloaljak.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();
    console.log("Connected to DB. Querying policies for table 'lorries'...");
    try {
        const res = await client.query(`
            SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check 
            FROM pg_policies 
            WHERE tablename = 'lorries';
        `);
        console.log("Policies:");
        console.log(JSON.stringify(res.rows, null, 2));

        console.log("\nChecking row count of lorries table directly...");
        const res2 = await client.query("SELECT COUNT(*), plate_number FROM public.lorries GROUP BY plate_number;");
        console.log("Lorries:", res2.rows);

    } catch (err) {
        console.error("Query failed:", err);
    } finally {
        await client.end();
    }
}
run();
