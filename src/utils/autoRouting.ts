

import { calculateLoad } from './logistics';

export interface DraftTrip {
    id: string; // "draft-N1-Central-1"
    name: string; // "N1: Central Trip #1"
    factoryId: string;
    zone: string;
    orders: any[]; // Extended SalesOrder
    totalVol: number;
    totalWeight: number;
    isOverloaded: boolean;
    recommendedDriverId?: string | null;
    recommendedDriverName?: string | null;
}

const MAX_VOL_M3 = 82 * 0.4489; // 82 rolls = ~36.8098 m3 (Standard Lorry Limit)
const MAX_WEIGHT_KG = 3000;

const KNOWN_TOWNS = [
    // Perak / North
    'Kamunting', 'Taiping', 'Simpang', 'Kuala Sepetang', 'Bagan Serai', 'Parit Buntar',
    'Ipoh', 'Sitiawan', 'Manjung', 'Kuala Kangsar', 'Batu Gajah', 'Teluk Intan', 'Tapah', 'Sungai Siput',
    // Penang
    'Batu Kawan', 'Bukit Mertajam', 'BM', 'Butterworth', 'Perai', 'Georgetown', 'Bayan Lepas', 'Nibong Tebal', 'Seberang Perai', 'Penang',
    // Kedah / Perlis
    'Kulim', 'Sungai Petani', 'Alor Setar', 'Jitra', 'Gurun', 'Kangar',
    // Selangor / KL / Central
    'Klang', 'Shah Alam', 'Subang', 'Petaling Jaya', 'PJ', 'Puchong', 'Cheras', 'Kepong', 'Rawang', 'Banting', 'Kajang', 'Semenyih', 'Bangi', 'Cyberjaya', 'Putrajaya', 'Kuala Lumpur', 'KL',
    // N. Sembilan
    'Nilai', 'Seremban', 'Senawang', 'Port Dickson', 'Rembau', 'Bahau',
    // Melaka
    'Melaka', 'Ayer Keroh', 'Alor Gajah', 'Jasin',
    // Johor
    'Johor Bahru', 'JB', 'Skudai', 'Pasir Gudang', 'Kulai', 'Kota Tinggi', 'Batu Pahat', 'Kluang', 'Muar', 'Tangkak', 'Segamat', 'Pontian', 'Senai', 'Ulu Tiram', 'Masai',
    // East Coast
    'Kota Bharu', 'Kelantan', 'Kuantan', 'Pahang', 'Kuala Terengganu', 'Terengganu'
];

/**
 * 从详细地址文本中提取具体城市/小镇名
 */
export function extractTownFromAddress(addr?: string | null): string | null {
    if (!addr) return null;
    const lower = addr.toLowerCase();
    for (const town of KNOWN_TOWNS) {
        const townLower = town.toLowerCase();
        if (new RegExp(`\\b${townLower}\\b`, 'i').test(lower) || lower.includes(townLower)) {
            return town;
        }
    }
    return null;
}

export function normalizeFactoryOrigin(originRaw?: string | null): string {
    if (!originRaw) return 'Taiping';
    const o = originRaw.trim().toUpperCase();
    if (o.includes('TAIPING') || o === 'T1' || o === 'SPD' || o.includes('OPM')) return 'Taiping';
    if (o.includes('NILAI') || o === 'N1') return 'Nilai';
    if (o.includes('JOHOR') || o === 'J1') return 'Johor';
    if (o.includes('KELANTAN') || o === 'K1') return 'Kelantan';
    return originRaw.trim();
}

export const generateDraftTrips = (orders: any[]): DraftTrip[] => {
    // 1. Group by Factory + Zone
    const groups: Record<string, any[]> = {};

    orders.forEach(o => {
        const factory = normalizeFactoryOrigin(o.trip_origin || o.tripOrigin || o.factory_id || o.factoryId);
        const rawAddr = o.deliveryAddress || o.delivery_address || '';
        const town = extractTownFromAddress(rawAddr);
        const zone = o.deliveryZone || o.zone || town || 'Central';

        const key = `${factory}|${zone}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(o);
    });

    const drafts: DraftTrip[] = [];

    // 2. Bin Packing per Group (with town clustering)
    Object.keys(groups).forEach(groupKey => {
        const [factory, zone] = groupKey.split('|');
        const groupOrders = groups[groupKey];

        // 预先计算体积与重量，并提取小镇
        const ordersWithMeta = groupOrders.map(o => {
            const stats = calculateLoad(o.items || [], null);
            const rawAddr = o.deliveryAddress || o.delivery_address || '';
            const town = extractTownFromAddress(rawAddr) || '';
            return {
                ...o,
                _vol: Number(stats.totalVol),
                _wgt: Number(stats.totalWeight),
                _town: town
            };
        });

        // 聚类排序：先按相同小镇聚合，同小镇内按体积从大到小排列
        ordersWithMeta.sort((a, b) => {
            if (a._town !== b._town) {
                return a._town.localeCompare(b._town);
            }
            return b._vol - a._vol;
        });

        // 装箱逻辑 (Bin Packing)
        const bins: Array<{ orders: any[]; currentVol: number; currentWeight: number; towns: Set<string> }> = [];

        ordersWithMeta.forEach(order => {
            let placed = false;
            // 优先放入包含相同小镇且有余量的车次
            for (const bin of bins) {
                const canFit = (bin.currentVol + order._vol <= MAX_VOL_M3) && (bin.currentWeight + order._wgt <= MAX_WEIGHT_KG);
                if (canFit) {
                    bin.orders.push(order);
                    bin.currentVol += order._vol;
                    bin.currentWeight += order._wgt;
                    if (order._town) bin.towns.add(order._town);
                    placed = true;
                    break;
                }
            }

            // 新起一辆车次
            if (!placed) {
                const newTowns = new Set<string>();
                if (order._town) newTowns.add(order._town);
                bins.push({
                    orders: [order],
                    currentVol: order._vol,
                    currentWeight: order._wgt,
                    towns: newTowns
                });
            }
        });

        // 转化为带人性化路线名称的 DraftTrip
        bins.forEach((bin, idx) => {
            const townList = Array.from(bin.towns);
            let displayDest = zone;
            if (townList.length > 0) {
                displayDest = townList.length <= 2 ? townList.join(' / ') : `${townList.slice(0, 2).join(' / ')} +${townList.length - 2}`;
            }

            drafts.push({
                id: `draft-${factory}-${zone}-${idx + 1}`,
                name: `${factory}: ${displayDest} #${idx + 1}`,
                factoryId: factory,
                zone: zone,
                orders: bin.orders,
                totalVol: bin.currentVol,
                totalWeight: bin.currentWeight,
                isOverloaded: bin.currentVol > MAX_VOL_M3
            });
        });
    });

    return drafts;
};

/**
 * Generates draft trips and automatically assigns recommended drivers based on their zone preferences.
 */
export const generateDraftTripsWithDrivers = (orders: any[], drivers: any[]): DraftTrip[] => {
    const drafts = generateDraftTrips(orders);
    
    return drafts.map((trip, idx) => {
        // Find a driver who prefers this zone
        let recommendedDriver = drivers.find(d => {
            const prefZone = (d.preferredZone || d.zone || '').toLowerCase();
            const tripZone = (trip.zone || '').toLowerCase();
            return prefZone && tripZone && (prefZone.includes(tripZone) || tripZone.includes(prefZone));
        });
        
        if (!recommendedDriver && drivers.length > 0) {
            // Fallback: assign to the next driver sequentially
            recommendedDriver = drivers[idx % drivers.length];
        }
        
        return {
            ...trip,
            recommendedDriverId: recommendedDriver?.uid || recommendedDriver?.id || null,
            recommendedDriverName: recommendedDriver?.name || 'Unassigned'
        };
    });
};
