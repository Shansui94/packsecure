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

async function getStock(client, loc, sku) {
    const res = await client.query(`
        SELECT COALESCE(SUM(change_qty), 0) as balance 
        FROM public.stock_ledger_v2 
        WHERE loc_id = $1 AND sku = $2
    `, [loc, sku]);
    return Number(res.rows[0].balance);
}

async function run() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log("Connected to PG successfully!");

        const loc = 'OPM Lama';
        const orenSku = 'BW-SL-CLR-100Mx50CMx2ROLL-ORN';
        const yelSku = 'BW-DL-CLR-100Mx100CMx1ROLL-YEL';

        console.log("\n=== Before Correction ===");
        console.log(`OPM Lama - OREN Stock: ${await getStock(client, loc, orenSku)}`);
        console.log(`OPM Lama - YEL Stock: ${await getStock(client, loc, yelSku)}`);

        // Insert corrections
        console.log("\nInserting correction entries into stock_ledger_v2...");
        
        // 1. Oren correction (+115)
        await client.query(`
            INSERT INTO public.stock_ledger_v2 (
                timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
            ) VALUES (
                NOW(), 'System Reset', $1, 115, $2,
                'System Correction: Refund double-deducted post-audit deliveries (DO-yan-260610-001, DO-yan-260608-001, DO-Yashin-260609-001)', 'CORRECTION-20260610-01'
            )
        `, [orenSku, loc]);

        // 2. Yellow correction (+14)
        await client.query(`
            INSERT INTO public.stock_ledger_v2 (
                timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
            ) VALUES (
                NOW(), 'System Reset', $1, 14, $2,
                'System Correction: Refund double-deducted post-audit deliveries (DO-Yashin-260609-001)', 'CORRECTION-20260610-02'
            )
        `, [yelSku, loc]);

        console.log("\n=== After Correction ===");
        console.log(`OPM Lama - OREN Stock: ${await getStock(client, loc, orenSku)}`);
        console.log(`OPM Lama - YEL Stock: ${await getStock(client, loc, yelSku)}`);

        console.log("\n✅ Inventory correction applied successfully!");

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
