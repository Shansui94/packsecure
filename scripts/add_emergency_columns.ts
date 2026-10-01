import pg from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Read connection string from mcp_config.json if not in env
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
    try {
        const mcpConfigPath = path.resolve('C:\\Users\\User\\.gemini\\config\\mcp_config.json');
        if (fs.existsSync(mcpConfigPath)) {
            const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
            const postgresArgs = mcpConfig?.mcpServers?.postgres?.args;
            if (Array.isArray(postgresArgs) && postgresArgs.length >= 3) {
                dbUrl = postgresArgs[2];
            }
        }
    } catch (e) {
        console.warn("Could not read mcp_config.json:", e);
    }
}

if (!dbUrl) {
    console.error("❌ Could not determine database connection URL");
    process.exit(1);
}

const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    console.log("🔌 Connecting to DB...");
    const client = await pool.connect();

    try {
        console.log("🛠️ Adding emergency columns to sys_users_v2...");
        await client.query(`
            ALTER TABLE sys_users_v2 
            ADD COLUMN IF NOT EXISTS emergency_name TEXT,
            ADD COLUMN IF NOT EXISTS emergency_relation TEXT,
            ADD COLUMN IF NOT EXISTS emergency_phone TEXT;
        `);
        console.log("✅ Added emergency columns to sys_users_v2!");

        console.log("🛠️ Adding emergency columns to users_public...");
        await client.query(`
            ALTER TABLE users_public 
            ADD COLUMN IF NOT EXISTS emergency_name TEXT,
            ADD COLUMN IF NOT EXISTS emergency_relation TEXT,
            ADD COLUMN IF NOT EXISTS emergency_phone TEXT;
        `);
        console.log("✅ Added emergency columns to users_public!");

        // Notify PostgREST to reload schema cache
        await client.query(`NOTIFY pgrst, 'reload schema';`);
        console.log("🔄 Notified PostgREST to reload schema cache!");

    } catch (err: any) {
        console.error("❌ Error:", err.message);
    } finally {
        client.release();
        await pool.end();
        console.log("👋 Done.");
    }
}

run();
