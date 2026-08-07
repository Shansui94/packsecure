import pg from 'pg';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
    connectionString: `postgresql://postgres:${encodeURIComponent('$QNQ4rAW*#%294z')}@db.kdahubyhwndgyloaljak.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();
    
    console.log("Reading migration SQL...");
    const sql = fs.readFileSync('supabase/deploy_auto_learning_schema.sql', 'utf8');
    
    console.log("Executing migration SQL in database...");
    try {
        await client.query(sql);
        console.log("Migration executed successfully!");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await client.end();
    }
}
run();
