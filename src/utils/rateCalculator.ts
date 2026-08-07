/**
 * Rate Calculator Utility for Packsecure OS
 * Handles time splitting for Malaysia Time (MYT, UTC+8)
 * 12:00 AM – 8:00 AM (Night Shift)
 * 8:00 AM – 12:00 AM (Day Shift)
 */

export interface RateConfig {
    machine_id: string;
    day_rate: number;   // 8:00 AM - 12:00 AM
    night_rate: number; // 12:00 AM - 8:00 AM
}

export const DEFAULT_RATES: Record<string, { day_rate: number; night_rate: number }> = {
    // Taiping Machines
    'T1-M03': { day_rate: 10, night_rate: 15 }, // Stretch Film (T1)
    'T4-M04': { day_rate: 10, night_rate: 15 }, // Stretch Film (T4)
    'T2-M01': { day_rate: 10, night_rate: 15 }, // 2M Double Layer (T2)
    'T5-M05': { day_rate: 10, night_rate: 10 }, // Recycle Machine (T5)
    'T3-M02': { day_rate: 8, night_rate: 13 },  // 1M Single Layer (T3)
    
    // Nilai Machines
    'N1-M01': { day_rate: 10, night_rate: 15 }, // 1M Double Layer (N1)
    'N2-M02': { day_rate: 10, night_rate: 15 }, // 1M Single Layer (N2)
    'N3-M03': { day_rate: 10, night_rate: 10 }, // Recycle Machine (N3)
    
    // Factory Login Modes (不登录机器，登录工厂)
    'FACTORY_MODE_1': { day_rate: 8, night_rate: 12 }, // Mode 1: 12am-8am RM12, 8am-12am RM8
    'FACTORY_MODE_2': { day_rate: 10, night_rate: 10 }, // Mode 2: RM10 flat
};

/**
 * Calculates hours spent in 12am-8am (Night) vs 8am-12am (Day) in MYT (UTC+8)
 */
export function calculateShiftSplit(
    clockInIso: string | null,
    clockOutIso: string | null,
    hoursWorked: number
): { nightHours: number; dayHours: number; totalHours: number } {
    const total = Math.max(0, Number(hoursWorked) || 0);
    if (total === 0) {
        return { nightHours: 0, dayHours: 0, totalHours: 0 };
    }

    if (!clockInIso) {
        // Fallback if no clock_in timestamp: assume day shift
        return { nightHours: 0, dayHours: total, totalHours: total };
    }

    const startMs = new Date(clockInIso).getTime();
    let endMs = clockOutIso ? new Date(clockOutIso).getTime() : startMs + (total * 3600000);
    
    if (isNaN(startMs) || endMs <= startMs) {
        return { nightHours: 0, dayHours: total, totalHours: total };
    }

    // Step by 1-minute intervals to accurately count MYT night vs day hours
    const MYT_OFFSET = 8 * 3600 * 1000; // UTC+8
    const STEP_MS = 60 * 1000; // 1 minute resolution

    let nightMinutes = 0;
    let dayMinutes = 0;

    for (let cur = startMs; cur < endMs; cur += STEP_MS) {
        const localMs = cur + MYT_OFFSET;
        const msInDay = localMs % (24 * 3600 * 1000);
        const hourOfDay = msInDay / (3600 * 1000);

        if (hourOfDay >= 0 && hourOfDay < 8) {
            nightMinutes += 1;
        } else {
            dayMinutes += 1;
        }
    }

    const totalMinutes = nightMinutes + dayMinutes;
    if (totalMinutes === 0) {
        return { nightHours: 0, dayHours: total, totalHours: total };
    }

    // Proportional scaling to match exact hoursWorked float
    const nightRatio = nightMinutes / totalMinutes;
    const nightHours = Math.round((total * nightRatio) * 100) / 100;
    const dayHours = Math.round((total - nightHours) * 100) / 100;

    return { nightHours, dayHours, totalHours: total };
}

/**
 * Resolves day and night rates for a machine or factory login mode from rateMap or default table
 */
export function getRatesForTarget(
    targetKey: string,
    rateMap: Map<string, { day_rate: number; night_rate: number }>
): { day_rate: number; night_rate: number } {
    const cleanKey = (targetKey || '').toUpperCase().trim();
    
    if (rateMap.has(cleanKey)) {
        return rateMap.get(cleanKey)!;
    }
    
    // Prefix lookup (e.g. T1-M03 vs T1)
    for (const [k, v] of rateMap.entries()) {
        if (cleanKey.startsWith(k) || k.startsWith(cleanKey)) {
            return v;
        }
    }

    if (DEFAULT_RATES[cleanKey]) {
        return DEFAULT_RATES[cleanKey];
    }

    for (const [k, v] of Object.entries(DEFAULT_RATES)) {
        if (cleanKey.startsWith(k) || k.startsWith(cleanKey)) {
            return v;
        }
    }

    // Generic default if unlisted
    return { day_rate: 10, night_rate: 10 };
}
