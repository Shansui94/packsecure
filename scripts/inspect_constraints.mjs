import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgresql://postgres:Neo1994son@db.kdahubyhwndgyloaljak.supabase.co:5432/postgres';

async function main() {
    const client = new Client({ connectionString });
    await client.connect();
    console.log("Connected to PostgreSQL successfully!");

    const res = await client.query(`
        SELECT conname, pg_get_constraintdef(c.oid) 
        FROM pg_constraint c 
        JOIN pg_namespace n ON n.oid = c.connamespace 
        WHERE conrelid = 'public.salary_advances'::regclass;
    `);

    console.log("Constraints on salary_advances:", res.rows);
    await client.end();
}

main().catch(err => {
    console.error("Error:", err);
});
