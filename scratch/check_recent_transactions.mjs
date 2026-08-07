import pg from 'pg';
const { Client } = pg;
import * as dotenv from 'dotenv';
dotenv.config();

const config = {
    user: 'postgres.kdahubyhwndgyloaljak',
    password: '$QNQ4rAW*#%294z',
    host: 'aws-1-ap-south-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
};

const skuMap = {
    'MERAH': 'BW-SL-CLR-100Mx100CMx1ROLL-RED',
    'OREN': 'BW-SL-CLR-100Mx100CMx1ROLL-ORN',
    'SL-33CM': 'BW-SL-CLR-100Mx33CMx3ROLL-GRN',
    'SL-25CM': 'BW-SL-CLR-100Mx25CMx4ROLL-GRN',
    'SL-20CM': 'BW-SL-CLR-100Mx20CMx5ROLL-GRN',
    'DL-FULL': 'BW-DL-CLR-100Mx100CMx1ROLL-YEL',
    'DL-HALF': 'BW-DL-CLR-100Mx50CMx2ROLL-BLU',
    'DL-33CM': 'BW-DL-CLR-100Mx33CMx3ROLL-BLU',
    'DL-25CM': 'BW-DL-CLR-100Mx25CMx4ROLL-BLU',
    'DL-20CM': 'BW-DL-CLR-100Mx20CMx5ROLL-BLU',
    'HITAM-FULL': 'BW-SL-BLK-100Mx100CMx1ROLL-GRN',
    'HITAM-HALF': 'BW-SL-BLK-100Mx50CMx2ROLL-RED',
    'HITAM-33CM': 'BW-SL-BLK-100Mx33CMx3ROLL-GRN',
    'HITAM-25CM': 'BW-SL-BLK-100Mx25CMx4ROLL-GRN',
    'HITAM-20CM': 'BW-SL-BLK-100Mx20CMx5ROLL-GRN'
};

async function run() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log("Connected to PG successfully!");

        const skus = Object.values(skuMap);
        
        // Sum change_qty by event_type for transactions after 2026-04-08
        const res = await client.query(`
            SELECT sku, event_type, SUM(change_qty) as total_qty
            FROM public.stock_ledger_v2
            WHERE sku = ANY($1::text[]) AND timestamp >= '2026-04-08 00:00:00'
            GROUP BY sku, event_type
        `, [skus]);

        const breakdown = {};
        skus.forEach(s => breakdown[s] = {});

        res.rows.forEach(r => {
            breakdown[r.sku][r.event_type] = Number(r.total_qty);
        });

        // Current stock after 2026-04-08
        const sumRes = await client.query(`
            SELECT sku, SUM(change_qty) as current_stock
            FROM public.stock_ledger_v2
            WHERE sku = ANY($1::text[]) AND timestamp >= '2026-04-08 00:00:00'
            GROUP BY sku
        `, [skus]);

        const recentStock = {};
        sumRes.rows.forEach(r => {
            recentStock[r.sku] = Number(r.current_stock);
        });

        const summary = [];
        Object.entries(skuMap).forEach(([friendlyName, sku]) => {
            const recentPhy = recentStock[sku] || 0;
            const breakDown = breakdown[sku] || {};
            const prod = breakDown['Production'] || 0;
            const transOut = breakDown['Transfer Out'] || 0;
            const transIn = breakDown['Transfer In'] || 0;
            const sysReset = breakDown['System Reset'] || 0;
            const audit = breakDown['Audit Adjustment'] || 0;
            const stockOut = breakDown['Stock Out'] || 0;

            summary.push({
                'Name': friendlyName,
                'Post-Reset Stock': recentPhy,
                'Production': prod,
                'Transfer Out': transOut,
                'Transfer In': transIn,
                'System Reset': sysReset,
                'Audit Adj': audit,
                'Stock Out': stockOut
            });
        });

        console.log("=== TRANSACTIONS SUMMARY AFTER 2026-04-08 ===");
        console.table(summary);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
