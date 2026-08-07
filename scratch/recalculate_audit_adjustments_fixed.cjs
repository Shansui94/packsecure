const pg = require('pg');
const { Client } = pg;

const config = {
    user: 'postgres.kdahubyhwndgyloaljak',
    password: '$QNQ4rAW*#%294z',
    host: 'aws-1-ap-south-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
};

async function main() {
    const client = new Client(config);
    await client.connect();
    try {
        console.log("=== Fetching all 19 audit records for AUDIT-20260624 at OPM Lama ===");
        const res = await client.query(`
            SELECT txn_id, sku, notes, timestamp
            FROM stock_ledger_v2
            WHERE ref_doc = 'AUDIT-20260624' AND loc_id = 'OPM Lama'
        `);

        const auditRecords = res.rows;
        console.log(`Found ${auditRecords.length} records.`);

        let successCount = 0;
        for (const r of auditRecords) {
            // Extract actual count from notes
            // notes format: "Auto-adjusted from Audit at [OPM Lama]. System: ..., Actual: 96"
            // or original notes format: "Auto-adjusted from Audit at [OPM Lama]. System: 0, Actual: 96"
            const match = r.notes.match(/Actual:\s*(-?\d+)/);
            if (!match) {
                console.error(`Could not parse actual count from notes: "${r.notes}" for ${r.sku}`);
                continue;
            }
            const actualCount = Number(match[1]);

            // Query database to sum change_qty before this timestamp at OPM Lama
            const sumRes = await client.query(`
                SELECT COALESCE(SUM(change_qty), 0) as total_qty
                FROM stock_ledger_v2
                WHERE sku = $1 AND loc_id = 'OPM Lama' AND timestamp < $2
            `, [r.sku, r.timestamp]);

            const systemStockBefore = Number(sumRes.rows[0].total_qty);
            const correctChangeQty = actualCount - systemStockBefore;
            const newNotes = `Auto-adjusted from Audit at [OPM Lama]. System: ${systemStockBefore}, Actual: ${actualCount}`;

            console.log(`SKU: ${r.sku}`);
            console.log(`  - Correct System Stock before: ${systemStockBefore}`);
            console.log(`  - Actual Count: ${actualCount}`);
            console.log(`  - Updating change_qty to: ${correctChangeQty}`);

            await client.query(`
                UPDATE stock_ledger_v2
                SET change_qty = $1, notes = $2
                WHERE txn_id = $3
            `, [correctChangeQty, newNotes, r.txn_id]);

            successCount++;
        }

        console.log(`\nSuccessfully recalculated and updated ${successCount} audit records in PostgreSQL.`);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

main().catch(console.error);
