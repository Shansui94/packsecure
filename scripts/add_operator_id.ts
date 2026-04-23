import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    let dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
    if (!dbUrl) {
        console.error("No DATABASE_URL found.");
        process.exit(1);
    }
    const client = new Client({
        connectionString: dbUrl,
    });
    await client.connect();
    console.log("Connected to DB.");
    await client.query(`ALTER TABLE public.machine_active_products ADD COLUMN IF NOT EXISTS operator_id UUID;`);
    console.log("Successfully added operator_id to machine_active_products.");
    await client.end();
}
main().catch(console.error);
