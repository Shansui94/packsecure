

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

const MAX_VOL_M3 = 20; // Standard 3-tonner limit
const MAX_WEIGHT_KG = 3000;

export const generateDraftTrips = (orders: any[]): DraftTrip[] => {
    // 1. Group by Factory + Zone
    const groups: Record<string, any[]> = {};

    orders.forEach(o => {
        // Default to N1/Central if missing data
        const factory = o.factory_id || 'N1';
        const zone = o.deliveryZone || o.zone || 'Central_Left'; // Fallback

        const key = `${factory}|${zone}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(o);
    });

    const drafts: DraftTrip[] = [];

    // 2. Bin Packing (First Fit Decreasing) per Group
    Object.keys(groups).forEach(groupKey => {
        const [factory, zone] = groupKey.split('|');
        const groupOrders = groups[groupKey];

        // Sort by Volume Descending (Biggest items first)
        // Need to calculate volume for sorting
        const ordersWithVol = groupOrders.map(o => {
            const stats = calculateLoad(o.items || [], null);
            return { ...o, _vol: Number(stats.totalVol), _wgt: Number(stats.totalWeight) };
        });

        ordersWithVol.sort((a, b) => b._vol - a._vol);

        // Bins
        const bins: Array<{ orders: any[], currentVol: number, currentWeight: number }> = [];

        ordersWithVol.forEach(order => {
            // Try to find a bin that fits
            let placed = false;
            for (const bin of bins) {
                if (bin.currentVol + order._vol <= MAX_VOL_M3 && bin.currentWeight + order._wgt <= MAX_WEIGHT_KG) {
                    bin.orders.push(order);
                    bin.currentVol += order._vol;
                    bin.currentWeight += order._wgt;
                    placed = true;
                    break;
                }
            }

            // Start new bin
            if (!placed) {
                bins.push({
                    orders: [order],
                    currentVol: order._vol,
                    currentWeight: order._wgt
                });
            }
        });

        // Convert Bins to DraftTrips
        bins.forEach((bin, idx) => {
            drafts.push({
                id: `draft-${factory}-${zone}-${idx + 1}`,
                name: `${factory === 'T1' ? 'Taiping' : 'Nilai'}: ${zone} #${idx + 1}`,
                factoryId: factory,
                zone: zone,
                orders: bin.orders,
                totalVol: bin.currentVol,
                totalWeight: bin.currentWeight,
                isOverloaded: bin.currentVol > MAX_VOL_M3 // Should be false by algorithm, but good for safety
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
