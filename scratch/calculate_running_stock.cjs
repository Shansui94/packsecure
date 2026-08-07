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
        const sku = 'BW-DL-BLK-100Mx100CMx1ROLL-RED';
        
        console.log("=== Fetching ALL OPM Lama transactions for DL-HITAM-FULL ===");
        const res = await client.query(`
            SELECT txn_id, timestamp, change_qty, event_type, ref_doc, notes, created_by_name
            FROM stock_ledger_v2
            WHERE sku = $1 AND loc_id = 'OPM Lama'
            ORDER BY timestamp ASC
        `, [sku]);

        let runningBalance = 0;
        console.log("Index | Timestamp | Change | Running Balance | Event | Ref | Notes | User");
        res.rows.forEach((row, idx) => {
            const change = Number(row.change_qty);
            runningBalance += change;
            // Print only recent transactions to avoid spamming, but let's check the last 20 transactions
            if (idx >= res.rows.length - 20) {
                console.log(`${idx + 1} | ${row.timestamp.toISOString()} | ${change >= 0 ? '+' : ''}${change} | ${runningBalance} | ${row.event_type} | ${row.ref_doc} | ${row.notes} | ${row.created_by_name}`);
            }
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

main().catch(console.error);
