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

function predictItemSpecs(item) {
    const sku = (item.sku || '').toLowerCase();
    const product = (item.product || item.name || '').toLowerCase();
    const name = sku || product;

    // Check if the item already has a defined volume/weight (from DB/inputs)
    let unitVol = item.volume_m3 || item.volume_cbm;
    let unitWeight = item.weight_kg || item.gross_weight_kg;

    if (unitVol && unitWeight) {
        return { volume: unitVol, weight: unitWeight, source: 'DB' };
    }

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
                const sizeMatch = nums.map(Number).find(n => validSizes.includes(n));
                if (sizeMatch !== undefined) {
                    width = sizeMatch;
                }
            }
        }
        
        // Predict proportionally to width (67x67x100cm = 0.4489 m3 for 100cm roll)
        const vol = 0.4489 * (width / 100);
        const weight = 6.8 * (width / 100);
        return { volume: vol, weight: weight, source: `Predicted BubbleWrap (${width}cm)` };
    }

    if (isStretchFilm) {
        if (name.includes('baby')) {
            // Baby roll
            return { volume: 0.003, weight: 1.0, source: 'Predicted StretchFilm (Baby Roll)' };
        }
        // Standard stretch film roll
        return { volume: 0.053248, weight: 14.0, source: 'Predicted StretchFilm (Standard)' };
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
            return { volume: 0.0225 * (width / 100), weight: 2.5 * (width / 100), source: `Predicted AirTube (${width}cm x 50m)` };
        }
        return { volume: 0.09 * (width / 100), weight: 15.0 * (width / 100), source: `Predicted AirTube (${width}cm x 300m)` };
    }

    // Tapes
    if (name.includes('tape')) {
        return { volume: 0.027, weight: 12.0, source: 'Predicted Tape (Carton)' };
    }

    // Bubble Envelopes
    if (name.includes('envelope') || name.includes('envolope')) {
        return { volume: 0.03375, weight: 15.0, source: 'Predicted Envelope (Carton)' };
    }

    // Default Other Items (45x25x30cm = 0.03375 m3)
    return { volume: 0.03375, weight: 15.0, source: 'Predicted Other (Default)' };
}

async function run() {
    const client = new Client(config);
    try {
        await client.connect();
        const res = await client.query(`
            SELECT sku, name, volume_cbm, gross_weight_kg 
            FROM master_items_v2 
            WHERE status = 'Active'
            ORDER BY sku;
        `);
        console.log(`Evaluating predictions for ${res.rows.length} items:`);
        
        let count = 0;
        res.rows.forEach(r => {
            const pred = predictItemSpecs({
                sku: r.sku,
                name: r.name,
                volume_cbm: r.volume_cbm,
                gross_weight_kg: r.gross_weight_kg
            });
            // Show only first 30 items or items that were predicted (non-DB)
            if (count < 40 || pred.source.startsWith('Predicted')) {
                console.log(`SKU: ${r.sku.padEnd(30)} | Name: ${r.name.padEnd(40)}`);
                console.log(`  -> Vol: ${pred.volume.toFixed(5)} m3 | Weight: ${pred.weight.toFixed(2)} kg | Src: ${pred.source}`);
                count++;
            }
        });
    } catch (e) {
        console.error("Error", e);
    } finally {
        await client.end();
    }
}

run();
