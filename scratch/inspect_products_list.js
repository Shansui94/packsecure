import pg from 'pg';
import fs from 'fs';
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
        const res = await client.query(`
            SELECT sku, name, type, width_mm, length_m, gross_weight_kg, volume_cbm, box_dims 
            FROM master_items_v2 
            WHERE status = 'Active'
            ORDER BY type, sku;
        `);
        let output = `Found ${res.rows.length} active products:\n`;
        res.rows.forEach(r => {
            output += `SKU: ${r.sku} | Name: ${r.name} | Type: ${r.type} | Width: ${r.width_mm} | Length: ${r.length_m} | Weight: ${r.gross_weight_kg} | Vol: ${r.volume_cbm} | Box: ${r.box_dims}\n`;
        });
        fs.writeFileSync('scratch/active_products.txt', output);
        console.log("Wrote to scratch/active_products.txt");
    } catch (e) {
        console.error("PG Connection/Query error", e);
    } finally {
        await client.end();
    }
}

run();
