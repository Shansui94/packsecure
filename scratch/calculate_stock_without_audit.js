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

const auditedSKUs = [
    { sku: 'BW-SL-CLR-100Mx25CMx4ROLL-GRN', actual: 39, auditChange: 15 },
    { sku: 'BW-SL-CLR-100Mx50CMx2ROLL-ORN', actual: 69, auditChange: 201 },
    { sku: 'BW-SL-CLR-100Mx100CMx1ROLL-RED', actual: 69, auditChange: 60 }
];

async function run() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log("Connected to PG database successfully!");

        for (const item of auditedSKUs) {
            console.log(`\n--- SKU: ${item.sku} ---`);
            
            // 1. Get current stock from view
            const viewRes = await client.query(`
                SELECT current_stock 
                FROM public.v2_inventory_view 
                WHERE sku = $1 AND loc_id = 'OPM Lama';
            `, [item.sku]);
            const currentStock = Number(viewRes.rows[0]?.current_stock || 0);
            console.log(`  Current Stock (including yesterday's audit): ${currentStock}`);

            // 2. Calculate stock without audit
            const stockWithoutAudit = currentStock - item.auditChange;
            console.log(`  Stock if yesterday's audit (+${item.auditChange}) is deleted: ${stockWithoutAudit}`);
            console.log(`  Actual Physical Count recorded: ${item.actual}`);

            if (stockWithoutAudit === item.actual) {
                console.log(`  ✅ PERFECT MATCH! Deleting the audit will result in exactly the physical count (${item.actual}).`);
            } else {
                console.log(`  ❌ MISMATCH! Stock without audit is ${stockWithoutAudit}, but physical count is ${item.actual}. Difference: ${stockWithoutAudit - item.actual}`);
            }
        }

    } catch (e) {
        console.error("PG Connection/Query error", e);
    } finally {
        await client.end();
    }
}

run();
