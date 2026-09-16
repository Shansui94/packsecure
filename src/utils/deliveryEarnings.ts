import { determineState } from './logistics';

export interface DeliveryRateRow {
    origin?: string;
    location_name?: string;
    base_rate?: number;
    max_places?: number;
    extra_rate_per_place?: number;
}

export interface TripForEarnings {
    trip_origin?: string | null;
    zone?: string | null;
    delivery_address?: string | null;
    delivery_zone?: string | null;
    trip_drop_count?: number | null;
}

function normalizeOrigin(originRaw?: string | null): string {
    if (!originRaw) return 'taiping';
    const o = originRaw.trim().toLowerCase();
    if (o === 'k1' || o === 'kelantan') return 'kelantan';
    if (o === 'j1' || o === 'johor') return 'johor';
    if (o === 'n1' || o === 'nilai') return 'nilai';
    if (o === 't1' || o.includes('opm') || o === 'spd') return 'taiping';
    return o;
}

export function buildDeliveryRateMap(rates: DeliveryRateRow[]): Record<string, DeliveryRateRow> {
    const map: Record<string, DeliveryRateRow> = {};
    rates.forEach((r) => {
        const origin = normalizeOrigin(r.origin);
        const loc = (r.location_name || '').toLowerCase();
        map[`${origin}-${loc}`] = r;
    });
    return map;
}

export function calcTripEarnings(trip: TripForEarnings, rateMap: Record<string, DeliveryRateRow>): number {
    const origin = normalizeOrigin(trip.trip_origin);
    const drops = Math.max(1, trip.trip_drop_count || 1);

    // 1. 优先尝试直接以 Zone / Delivery Zone 精确匹配
    const primaryZone = (trip.zone || trip.delivery_zone || '').trim().toLowerCase();
    let rateInfo = primaryZone ? rateMap[`${origin}-${primaryZone}`] : undefined;

    // 2. 若未命中且存在送货地址，自动在 delivery_address 中扫描该出发地下配置的所有城市/区域名
    const addr = (trip.delivery_address || '').trim();
    if (!rateInfo && addr) {
        const addrLower = addr.toLowerCase();
        for (const key of Object.keys(rateMap)) {
            if (key.startsWith(`${origin}-`)) {
                const loc = (rateMap[key].location_name || '').trim().toLowerCase();
                if (loc && loc.length >= 2) {
                    if (addrLower.includes(loc) || new RegExp(`\\b${loc}\\b`, 'i').test(addrLower)) {
                        rateInfo = rateMap[key];
                        break;
                    }
                }
            }
        }
    }

    // 3. 若仍未命中，尝试使用从地址或区域解析出的省份（State）回退匹配
    if (!rateInfo) {
        const stateName = determineState(addr || primaryZone).toLowerCase();
        if (stateName && stateName !== 'other') {
            rateInfo = rateMap[`${origin}-${stateName}`];
        }
    }

    if (!rateInfo) return 0;

    const base = Number(rateInfo.base_rate) || 0;
    const maxPlaces = Number(rateInfo.max_places) || 0;
    const extraPlaces = Math.max(0, drops - maxPlaces);
    const extraRate = extraPlaces * (Number(rateInfo.extra_rate_per_place) || 0);
    return base + extraRate;
}

/** Delivered on or before deadline day end (MYT) */
export function isOnTimeDelivery(podTimestamp: string | null | undefined, deadline: string | null | undefined): boolean {
    if (!podTimestamp || !deadline) return false;
    const deadlineEnd = new Date(`${deadline.split('T')[0]}T23:59:59+08:00`);
    return new Date(podTimestamp).getTime() <= deadlineEnd.getTime();
}
