
import { DeliveryZone } from '../types';

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

// Load Calculator
export const calculateLoad = (items: any[], vehicle: any) => {
    // 1. Calculate Total Volume required
    let totalVol = 0;
    let totalWeight = 0;

    items.forEach(item => {
        // Fallback or use DB value if available
        const qty = item.quantity || 0;

        // Approx Metrics if DB is empty (Standard Roll)
        // 50cm width x 200m length roll ~ 0.05 m3 approx
        const unitVol = item.volume_m3 || 0.05;
        const unitWeight = item.weight_kg || 15;

        totalVol += (unitVol * qty);
        totalWeight += (unitWeight * qty);
    });

    // 2. Compare against Vehicle
    // If no vehicle selected, just return raw totals
    if (!vehicle) return { totalVol, totalWeight, percentVol: 0, percentWeight: 0, status: 'N/A' };

    const maxVol = vehicle.max_volume_m3 || 20; // Default 20m3 (3-tonner)
    const maxWeight = vehicle.max_weight_kg || 5000;

    const percentVol = (totalVol / maxVol) * 100;
    const percentWeight = (totalWeight / maxWeight) * 100;

    return {
        totalVol: totalVol.toFixed(2),
        totalWeight: totalWeight.toFixed(2),
        percentVol: Math.min(percentVol, 100).toFixed(1),
        percentWeight: Math.min(percentWeight, 100).toFixed(1),
        isOverloaded: percentVol > 100 || percentWeight > 100,
        spaceRemaining: Math.max(0, maxVol - totalVol).toFixed(2)
    };
};

export const determineZone = (address: string): DeliveryZone => {
    const lowerAddr = address.toLowerCase();

    // Central_Left
    const leftKeywords = [
        'klang', 'dengkil', 'puchong', 'kapar', 'shah alam', 'puncak alam',
        'telok panglima', 'tanjung karang', 'sabak bernam', 'kuala selangor',
        'subang jaya', 'jenjarom', 'petaling jaya', 'pj', 'nilai', 'melaka', 'n. sembilan',
        'negeri sembilan'
    ];

    if (leftKeywords.some(k => lowerAddr.includes(k))) return 'Central_Left';

    // Central_Right
    const rightKeywords = [
        'rawang', 'kuala lumpur', 'kl', 'cheras', 'sungai buloh',
        'semenyih', 'seri kembangan', 'batu caves', 'balakong', 'kajang',
        'ampang', 'selayang', 'kepong', 'bandar baru bangi', 'serdang',
        'serendah', 'batang kali', 'tmn danau kota', 'sepang'
    ];

    if (rightKeywords.some(k => lowerAddr.includes(k))) return 'Central_Right';

    // Fallbacks (Simple heuristics for other zones)
    if (lowerAddr.includes('johor') || lowerAddr.includes('jb')) return 'South';
    if (lowerAddr.includes('penang') || lowerAddr.includes('kedah') || lowerAddr.includes('perak')) return 'North';
    if (lowerAddr.includes('pahang') || lowerAddr.includes('terengganu') || lowerAddr.includes('kelantan')) return 'East';

    // Default
    return 'Central_Left';
};

export const determineState = (address: string): string => {
    const lowerAddr = address.toLowerCase();

    if (lowerAddr.includes('johor') || lowerAddr.includes('jb') || lowerAddr.includes('skudai') || lowerAddr.includes('pasir gudang')) return 'Johor';
    if (lowerAddr.includes('penang') || lowerAddr.includes('pulau pinang') || lowerAddr.includes('georgetown') || lowerAddr.includes('butterworth')) return 'Penang';
    if (lowerAddr.includes('kuala lumpur') || lowerAddr.includes('kl ') || lowerAddr.includes('wilayah persekutuan')) return 'K. Lumpur';
    if (lowerAddr.includes('selangor') || lowerAddr.includes('shah alam') || lowerAddr.includes('petaling jaya') || lowerAddr.includes('klang') || lowerAddr.includes('kajang')) return 'Selangor';
    if (lowerAddr.includes('melaka') || lowerAddr.includes('malacca')) return 'Melaka';
    if (lowerAddr.includes('negeri sembilan') || lowerAddr.includes('seremban') || lowerAddr.includes('nilai')) return 'N. Sembilan';
    if (lowerAddr.includes('perak') || lowerAddr.includes('ipoh') || lowerAddr.includes('taiping')) return 'Perak';
    if (lowerAddr.includes('kedah')) return 'Kedah';
    if (lowerAddr.includes('pahang') || lowerAddr.includes('kuantan')) return 'Pahang';
    if (lowerAddr.includes('terengganu')) return 'Terengganu';
    if (lowerAddr.includes('kelantan')) return 'Kelantan';

    // Fallback based on typical Central area if no state found
    if (lowerAddr.includes('puchong') || lowerAddr.includes('bangi') || lowerAddr.includes('cyberjaya')) return 'Selangor';
    if (lowerAddr.includes('cheras')) return 'K. Lumpur';

    return 'Other'; // Or 'Unknown'
};

// -- AI Factory Scoring Logic --

// Approximation of "score" based on Zone (0-100)
// Higher is shorter distance / better
const getZoneDistanceScore = (zone: DeliveryZone, factoryId: string): number => {
    if (factoryId.includes('OPM') || factoryId === 'SPD') { // North
        if (zone === 'North') return 100;
        if (zone === 'Central_Left' || zone === 'Central_Right') return 40;
        return 10; // South/East is very far
    }
    if (factoryId === 'Nilai') { // Nilai (Central/South)
        if (zone === 'Central_Left' || zone === 'Central_Right') return 100;
        if (zone === 'South') return 90;
        if (zone === 'East') return 80;
        if (zone === 'North') return 30;
    }
    return 0;
};

// Check if Factory has enough stock for all items
// Returns 0-100 score (100 = Full Stock, 0 = No Stock)


export const findBestFactory = (zone: DeliveryZone, items: any[], stockMap: Record<string, any>) => {
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
