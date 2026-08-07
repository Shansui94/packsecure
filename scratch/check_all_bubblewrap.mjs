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

// Map old names to new SKUs to search easily
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

        // 1. Fetch live inventory view for all these SKUs
        const skus = Object.values(skuMap);
        const invRes = await client.query(`
            SELECT sku, SUM(current_stock) as physical_stock
            FROM public.v2_inventory_view
            WHERE sku = ANY($1::text[])
            GROUP BY sku
        `, [skus]);
        
        const physicalStockBySku = {};
        invRes.rows.forEach(r => {
            physicalStockBySku[r.sku] = Number(r.physical_stock);
        });

        // 2. Fetch pending order quantities by SKU (reserved stock)
        const orderRes = await client.query(`
            SELECT items
            FROM public.sales_orders
            WHERE status IN ('New', 'Production', 'Ready')
        `);

        const reservedStockBySku = {};
        skus.forEach(s => reservedStockBySku[s] = 0);

        orderRes.rows.forEach(order => {
            if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                    const sku = item.sku?.trim();
                    const qty = Number(item.quantity) || 0;
                    if (sku && reservedStockBySku[sku] !== undefined) {
                        reservedStockBySku[sku] += qty;
                    }
                });
            }
        });

        // 3. Summarize transactions count and change_qty per SKU from ledger
        const ledgerRes = await client.query(`
            SELECT sku, event_type, COUNT(*) as tx_count, SUM(change_qty) as tx_sum
            FROM public.stock_ledger_v2
            WHERE sku = ANY($1::text[])
            GROUP BY sku, event_type
        `, [skus]);

        const ledgerBreakdown = {};
        skus.forEach(s => {
            ledgerBreakdown[s] = {};
        });

        ledgerRes.rows.forEach(r => {
            ledgerBreakdown[r.sku][r.event_type] = {
                count: Number(r.tx_count),
                sum: Number(r.tx_sum)
            };
        });

        // 4. Combine and print results
        const summary = [];
        Object.entries(skuMap).forEach(([friendlyName, sku]) => {
            const phy = physicalStockBySku[sku] || 0;
            const res = reservedStockBySku[sku] || 0;
            const avail = phy - res;
            
            const breakDown = ledgerBreakdown[sku] || {};
            const prodSum = breakDown['Production']?.sum || 0;
            const transOutSum = breakDown['Transfer Out']?.sum || 0;
            const resetSum = breakDown['System Reset']?.sum || 0;
            const auditSum = breakDown['Audit Adjustment']?.sum || 0;

            summary.push({
                'Friendly Name': friendlyName,
                'SKU': sku,
                'Physical (Phy)': phy,
                'Reserved (Res)': res,
                'Available (Avail)': avail,
                'Prod In': prodSum,
                'Trans Out': transOutSum,
                'System Reset': resetSum,
                'Audit Adj': auditSum
            });
        });

        console.table(summary);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
