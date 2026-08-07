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

function predictItemSpecs(skuVal, nameVal) {
    const sku = (skuVal || '').toLowerCase();
    const product = (nameVal || '').toLowerCase();
    const name = sku || product;

    // Dynamic Predictions
    const isBubbleWrap = 
        sku.startsWith('bw-') || 
        product.includes('bubblewrap') || 
        product.includes('bubble wrap') || 
        (sku.includes('cukupp-') && !sku.includes('tape')) ||
        sku.endsWith('-roll') ||
        ['merah', 'oren', 'dl-full', 'dl-half', 'dl-hitam-full', 'dl-hitam-half', 'dl-hitam-20cm', 'dl-hitam-25cm', 'dl-hitam-33cm', 'dl-20cm', 'dl-25cm', 'dl-33cm', 'hitam-full', 'hitam-20cm', 'hitam-25cm', 'hitam-33cm', 'hitam-half', 'sl-20cm', 'sl-25cm', 'sl-33cm', 'sl silver full', 'dl slr full'].some(term => product.includes(term));

    const isStretchFilm = 
        sku.startsWith('sf-') ||
        product.includes('stretch film') ||
        product.includes('strech film') ||
        product.includes('stretchfilm') ||
        (product.includes('film') && !isBubbleWrap);

    if (isBubbleWrap) {
        let width = 100; // Default width in cm
        const cmMatch = name.match(/(\d+)\s*cm\s*(?:x\s*(\d+)\s*roll)?/i);
        if (cmMatch) {
            const w = parseInt(cmMatch[1]);
            const r = cmMatch[2] ? parseInt(cmMatch[2]) : 1;
            width = w * r;
        } else {
            const nums = name.match(/\d+/g);
            if (nums) {
                const validSizes = [17, 20, 25, 28, 32, 33, 35, 38, 40, 45, 50, 60, 100];
                for (const numStr of nums) {
                    const n = parseInt(numStr, 10);
                    if (validSizes.includes(n)) {
                        width = n;
                        break;
                    }
                }
            }
        }
        
        const vol = 0.4489 * (width / 100);
        const weight = 6.8 * (width / 100);
        return { volume: vol, weight: weight };
    }

    if (isStretchFilm) {
        if (name.includes('baby')) {
            return { volume: 0.003, weight: 1.0 };
        }
        return { volume: 0.053248, weight: 14.0 };
    }

    // Air Tubes
    if (name.includes('airtube') || name.includes('air tube')) {
        let width = 40;
        let length = 300;
        const wMatch = name.match(/(\d+)\s*cm/i);
        if (wMatch) width = parseInt(wMatch[1]);
        const lMatch = name.match(/(\d+)\s*m\b/i);
        if (lMatch) length = parseInt(lMatch[1]);

        if (length === 50) {
            return { volume: 0.0225 * (width / 100), weight: 2.5 * (width / 100) };
        }
        return { volume: 0.09 * (width / 100), weight: 15.0 * (width / 100) };
    }

    // Tapes
    if (name.includes('tape')) {
        return { volume: 0.027, weight: 12.0 };
    }

    // Bubble Envelopes
    if (name.includes('envelope') || name.includes('envolope')) {
        return { volume: 0.03375, weight: 15.0 };
    }

    // Default Other Items (45x25x30cm = 0.03375 m3, 15kg)
    return { volume: 0.03375, weight: 15.0 };
}

async function run() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log("Connected to PG database successfully!");

        // Fetch all active products
        const res = await client.query(`
            SELECT sku, name, volume_cbm, gross_weight_kg 
            FROM master_items_v2 
            WHERE status = 'Active';
        `);
        console.log(`Found ${res.rows.length} active products in database.`);

        let updateCount = 0;
        for (const row of res.rows) {
            // Check if weight/volume is empty (null or 0)
            const currentVol = Number(row.volume_cbm || 0);
            const currentWeight = Number(row.gross_weight_kg || 0);

            if (currentVol === 0 || currentWeight === 0) {
                const pred = predictItemSpecs(row.sku, row.name);
                
                // Keep existing values if they are non-zero
                const newVol = currentVol > 0 ? currentVol : pred.volume;
                const newWeight = currentWeight > 0 ? currentWeight : pred.weight;

                await client.query(`
                    UPDATE master_items_v2 
                    SET volume_cbm = $1, gross_weight_kg = $2 
                    WHERE sku = $3;
                `, [newVol, newWeight, row.sku]);
                
                updateCount++;
                if (updateCount <= 10) {
                    console.log(`Updated SKU: ${row.sku} -> Vol: ${newVol.toFixed(5)} cbm, Weight: ${newWeight.toFixed(2)} kg`);
                }
            }
        }

        console.log(`\nSuccessfully populated ${updateCount} products in database with their estimated volume and weight.`);

    } catch (e) {
        console.error("Migration error", e);
    } finally {
        await client.end();
    }
}

run();
