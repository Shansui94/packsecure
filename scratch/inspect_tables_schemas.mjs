import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
    connectionString: `postgresql://postgres:${encodeURIComponent('$QNQ4rAW*#%294z')}@db.kdahubyhwndgyloaljak.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();
    
    const tables = ['production_logs_v2', 'recipe_items', 'bom_headers_v2', 'bom_items_v2'];
    for (const table of tables) {
        console.log(`=== Columns of ${table} ===`);
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = '${table}'
            ORDER BY ordinal_position;
        `);
        console.log(res.rows);
    }

    await client.end();
}
run();
