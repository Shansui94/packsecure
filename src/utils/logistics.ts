

// Haversine Formula for GPS Distance (km)
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
};

const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
};

// Removed unused WAREHOUSES import

// Factory Coordinates mapping for WAREHOUSES
const WAREHOUSE_COORDS = [
    { id: 'Nilai', name: 'Nilai', lat: 2.8167, lng: 101.7958 },
    { id: 'OPM Lama', name: 'OPM Lama', lat: 4.8500, lng: 100.7333 },
    { id: 'OPM Corner', name: 'OPM Corner', lat: 4.8505, lng: 100.7340 },
    { id: 'SPD', name: 'SPD', lat: 4.8510, lng: 100.7350 }
];

export const findNearestFactory = (targetLat: number, targetLng: number) => {
    let nearest = null;
    let minDist = Infinity;

    WAREHOUSE_COORDS.forEach(f => {
        const d = calculateDistance(targetLat, targetLng, f.lat, f.lng);
        if (d < minDist) {
            minDist = d;
            nearest = f;
        }
    });

    return { factory: nearest, distance: minDist };
};

// Helper function to predict item weight and volume
export const predictItemSpecs = (item: any): { volume: number; weight: number; source: string } => {
    const sku = (item.sku || '').toLowerCase();
    const product = (item.product || item.name || '').toLowerCase();
    const name = sku || product;

    // Check if the item already has a defined volume/weight (from DB/inputs)
    let unitVol = item.volume_m3 || item.volume_cbm || item.volume;
    let unitWeight = item.weight_kg || item.gross_weight_kg || item.weight;

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
                for (const numStr of nums) {
                    const n = parseInt(numStr, 10);
                    if (validSizes.includes(n)) {
                        width = n;
                        break;
                    }
                }
            }
        }
        // Predict proportionally to width (67x67x100cm = 0.4489 m3 and 6.8kg for 100cm roll)
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

    // Default Other Items (45x25x30cm = 0.03375 m3, 15kg)
    return { volume: unitVol || 0.03375, weight: unitWeight || 15.0, source: 'Predicted Other (Default)' };
};

// Load Calculator
export const calculateLoad = (items: any[], vehicle: any) => {
    // 1. Calculate Total Volume required
    let totalVol = 0;
    let totalWeight = 0;

    items.forEach(item => {
        const qty = item.quantity || 0;
        const specs = predictItemSpecs(item);
        totalVol += (specs.volume * qty);
        totalWeight += (specs.weight * qty);
    });

    // 2. Compare against Vehicle
    // Default capacity if no vehicle or plate is assigned
    let capacityRolls = 82; // Default 82 rolls
    let maxVol = capacityRolls * 0.4489; // ~36.8098 m³
    let maxWeight = 3000; // Default 3000 kg (3-tonner)

    if (vehicle) {
        // Prioritize DB fields (both camelCase and snake_case)
        const dbVol = vehicle.maxVolumeM3 || vehicle.max_volume_m3 || vehicle.max_volume;
        const dbWeight = vehicle.maxWeightKg || vehicle.max_weight_kg || vehicle.max_weight;

        if (dbVol != null && Number(dbVol) > 0) {
            maxVol = Number(dbVol);
        } else {
            // Fallback to plate matching if DB fields are missing/zero
            const plate = (vehicle.plateNumber || vehicle.plate_number || '').toLowerCase().replace(/\s+/g, '');
            if (plate === 'vpc9821') {
                capacityRolls = 65;
                maxVol = capacityRolls * 0.4489;
            } else if (plate === 'aph9821') {
                capacityRolls = 92;
                maxVol = capacityRolls * 0.4489;
            }
        }

        if (dbWeight != null && Number(dbWeight) > 0) {
            maxWeight = Number(dbWeight);
        }
    }

    const percentVol = (totalVol / maxVol) * 100;
    const percentWeight = (totalWeight / maxWeight) * 100;

    return {
        totalVol: totalVol.toFixed(2),
        totalWeight: totalWeight.toFixed(2),
        percentVol: percentVol.toFixed(1),
        percentWeight: percentWeight.toFixed(1),
        isOverloaded: percentVol > 100 || percentWeight > 100,
        spaceRemaining: Math.max(0, maxVol - totalVol).toFixed(2),
        maxVol: maxVol.toFixed(2),
        maxWeight: maxWeight.toFixed(0)
    };
};



export const determineState = (address: string): string => {
    const lowerAddr = address.toLowerCase();

    if (lowerAddr.includes('johor') || lowerAddr.includes('jb') || lowerAddr.includes('skudai') || lowerAddr.includes('pasir gudang')) return 'Johor';
    if (lowerAddr.includes('penang') || lowerAddr.includes('pulau pinang') || lowerAddr.includes('georgetown') || lowerAddr.includes('butterworth')) return 'Penang';
    if (lowerAddr.includes('kuala lumpur') || lowerAddr.includes('kl ') || lowerAddr.includes('klang valley') || lowerAddr.includes('wilayah persekutuan') || lowerAddr.endsWith(' kl') || lowerAddr.includes(',kl') || lowerAddr.includes(' kl,')) return 'K. Lumpur';
    if (lowerAddr.includes('selangor') || lowerAddr.includes('shah alam') || lowerAddr.includes('petaling jaya') || lowerAddr.includes('klang') || lowerAddr.includes('kajang') || lowerAddr.includes('rawang') || lowerAddr.includes('semenyih')) return 'Selangor';
    if (lowerAddr.includes('melaka') || lowerAddr.includes('malacca')) return 'Melaka';
    if (lowerAddr.includes('negeri sembilan') || lowerAddr.includes('seremban') || lowerAddr.includes('nilai')) return 'N. Sembilan';
    if (lowerAddr.includes('perak') || lowerAddr.includes('ipoh') || lowerAddr.includes('taiping') || lowerAddr.includes('sitiawan')) return 'Perak';
    if (lowerAddr.includes('kedah') || lowerAddr.includes('kulim') || lowerAddr.includes('sungai petani')) return 'Kedah';
    if (lowerAddr.includes('pahang') || lowerAddr.includes('kuantan')) return 'Pahang';
    if (lowerAddr.includes('terengganu')) return 'Terengganu';
    if (lowerAddr.includes('kelantan') || lowerAddr.includes('kota bharu') || lowerAddr.includes('rantau panjang')) return 'Kelantan';
    if (lowerAddr.includes('perlis')) return 'Perlis';
    if (lowerAddr.includes('sabah')) return 'Sabah';
    if (lowerAddr.includes('sarawak')) return 'Sarawak';

    // Fallback based on typical Central area if no state found
    if (lowerAddr.includes('puchong') || lowerAddr.includes('bangi') || lowerAddr.includes('cyberjaya')) return 'Selangor';
    if (lowerAddr.includes('cheras')) return 'K. Lumpur';

    return 'Other'; // Or 'Unknown'
};

// -- AI Factory Scoring Logic --

// Approximation of "score" based on Zone (0-100)
// Higher is shorter distance / better
const getZoneDistanceScore = (zone: string, factoryId: string): number => {
    // Basic heuristics: if the zone text includes North/Penang, favor North factories.
    const lowerZone = (zone || '').toLowerCase();
    
    if (factoryId.includes('OPM') || factoryId === 'SPD') { // North
        if (lowerZone.includes('north') || lowerZone.includes('penang') || lowerZone.includes('perak')) return 100;
        if (lowerZone.includes('kl') || lowerZone.includes('selangor')) return 40;
        return 10;
    }
    if (factoryId === 'Nilai') { // Nilai (Central/South)
        if (lowerZone.includes('kl') || lowerZone.includes('selangor')) return 100;
        if (lowerZone.includes('south') || lowerZone.includes('johor')) return 90;
        if (lowerZone.includes('east') || lowerZone.includes('pahang')) return 80;
        if (lowerZone.includes('north') || lowerZone.includes('penang')) return 30;
    }
    return 50; // Default flat score
};

// Check if Factory has enough stock for all items
// Returns 0-100 score (100 = Full Stock, 0 = No Stock)


export const findBestFactory = (zone: string, items: any[], stockMap: Record<string, any>) => {
    const scored = WAREHOUSE_COORDS.map(f => {
        // 1. Distance Score (40%)
        const distScore = getZoneDistanceScore(zone, f.id);

        let stockScore = 0;
        items.forEach(i => {
            const global = stockMap[i.sku];
            let local = 0;
            if (typeof global === 'number') {
                local = (f.id === 'Nilai') ? global : 0;
            } else {
                local = global?.[f.id] || 0;
            }
            stockScore += (Math.min(local, i.quantity) / (i.quantity || 1));
        });
        stockScore = (items.length > 0) ? (stockScore / items.length) * 100 : 100;


        // Combined
        const finalScore = (distScore * 0.4) + (stockScore * 0.6);

        return { ...f, distScore, stockScore, finalScore };
    });

    // Sort Descending
    scored.sort((a, b) => b.finalScore - a.finalScore);

    return scored[0]; // Winner
};
