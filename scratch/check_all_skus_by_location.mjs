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
        
        const res = await client.query(`
            SELECT sku, loc_id, SUM(change_qty) as balance
            FROM public.stock_ledger_v2
            WHERE sku = ANY($1::text[])
            GROUP BY sku, loc_id
            ORDER BY sku, loc_id
        `, [skus]);

        // Transform results into a location-wise matrix
        const matrix = {};
        skus.forEach(s => {
            const friendly = Object.keys(skuMap).find(key => skuMap[key] === s);
            matrix[friendly] = { SKU: s };
        });

        res.rows.forEach(r => {
            const friendly = Object.keys(skuMap).find(key => skuMap[key] === r.sku);
            const loc = r.loc_id || 'null';
            matrix[friendly][loc] = Number(r.balance);
        });

        console.table(Object.values(matrix));

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
