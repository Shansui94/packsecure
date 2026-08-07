import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = 'postgresql://postgres:packsecure2024@db.kdahubyhwndgyloaljak.supabase.co:5432/postgres';

async function deploy() {
    console.log("🚀 Starting database migration for Team Chat + Canvas...");
    
    const client = new pg.Client({ connectionString });
    try {
        await client.connect();
        console.log("🔌 Connected to PostgreSQL database.");
        
        const sqlPath = path.resolve(__dirname, '..', 'supabase', 'create_team_chat.sql');
        console.log(`📖 Reading SQL file from: ${sqlPath}`);
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log("⚡ Running SQL migration script...");
        await client.query(sql);
        console.log("✅ SQL migration script executed successfully!");
    } catch (error) {
        console.error("❌ Database migration failed:", error);
        process.exit(1);
    } finally {
        await client.end();
        console.log("🔌 Disconnected from database.");
    }
}

deploy();
