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
        const sku = 'BW-SL-CLR-100Mx100CMx1ROLL-RED';
        console.log(`=== Querying all transactions for ${sku} at OPM Lama ===`);
        const res = await client.query(`
            SELECT txn_id, timestamp, change_qty, event_type, ref_doc, notes
            FROM stock_ledger_v2
            WHERE sku = $1 AND loc_id = 'OPM Lama'
            ORDER BY timestamp ASC
        `, [sku]);

        console.log(`Total transactions found: ${res.rows.length}`);
        
        let balance = 0;
        res.rows.forEach((row, idx) => {
            const qty = Number(row.change_qty);
            balance += qty;
            if (idx >= res.rows.length - 30) {
                console.log(`${idx + 1}. [${row.timestamp.toISOString()}] Qty: ${qty >= 0 ? '+' : ''}${qty} | Bal: ${balance} | Event: ${row.event_type} | Ref: ${row.ref_doc} | Notes: ${row.notes}`);
            }
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

main().catch(console.error);
