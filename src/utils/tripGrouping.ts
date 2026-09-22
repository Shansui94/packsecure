/**
 * Trip Grouping Utility for Packsecure OS
 * 
 * Reconciles the relationship between DOs (Sales Orders) and Trips:
 * - 1 Trip can contain multiple Delivery Orders (DOs) sharing a `trip_id` or trip notes.
 * - 1 Trip can also be a single Delivery Order with multiple drops (`trip_drop_count > 1`).
 * - Ensures Base Rate is paid once per Trip, and Extra Drop allowance is calculated for the Trip.
 */

export interface GroupedTrip {
    id: string; // Primary order ID
    order_ids: string[]; // All sales_order IDs belonging to this trip
    trip_id?: string | null;
    order_number: string; // Comma-separated list of DO numbers, e.g. "OPM2609-0706, OPM2609-0707"
    customer: string; // Comma-separated unique customer names
    items: any[]; // Combined cargo items
    notes?: string | null;
    status: string; // 'Delivered' | 'In-Transit' | 'Loaded' | 'Pending Approval' | 'Cancelled'
    job_type?: string;
    pod_photo_url?: string | null;
    pod_signature_url?: string | null;
    proof_of_load_url?: string | null;
    driver_id?: string | null;
    lorry_id?: string | null;
    lorry_plate?: string;
    trip_origin?: string | null;
    zone?: string | null;
    trip_drop_count: number; // Total drops for the entire trip
    delivery_address?: string | null;
    edit_status?: string | null;
    pending_edit_payload?: any | null;
    driver_confirmed: boolean;
    baseRate: number;
    extraRate: number; // Total extra drops amount
    extraRatePerPlace: number;
    extraDrops: number; // Count of extra drops
    earnings: number; // baseRate + extraRate (or approved amount)
    deadline?: string | null;
    pod_timestamp?: string | null;
    pod_signed_by?: string | null;
    isDelivered: boolean;
    isUnscanned: boolean;
    displayString: string;
    orders: any[]; // The underlying individual sales_orders
}

/**
 * Extract trip number or tag from order notes (matches DriverDelivery and OrderSummary)
 */
export function extractTripIdentifier(notes?: string | null): { tripSeq?: number; tripTag?: string } {
    if (!notes) return {};
    const lower = notes.toLowerCase();

    // 1. Bracket format: [Trip: trip 2 malam hantar]
    const mBracket = notes.match(/\[Trip:\s*([^\]]+)\]/i);
    if (mBracket) {
        const content = mBracket[1].trim();
        const numMatch = content.match(/\b(\d+)\b/);
        if (numMatch) {
            return { tripSeq: parseInt(numMatch[1], 10), tripTag: `Trip ${numMatch[1]}` };
        }
        return { tripTag: content };
    }

    // 2. Check "trip 1", "trip 2", "trip 3"
    const mTrip = lower.match(/\btrip\s*(\d+)\b/);
    if (mTrip) {
        return { tripSeq: parseInt(mTrip[1], 10), tripTag: `Trip ${mTrip[1]}` };
    }

    // 3. Check "1p", "2p", "3p" (Malaysian pusingan / trip shorthand)
    const mP = lower.match(/\b(\d+)\s*p\b/);
    if (mP) {
        return { tripSeq: parseInt(mP[1], 10), tripTag: `Trip ${mP[1]}` };
    }

    return {};
}

/**
 * Helper to match delivery rate for a specific order and origin
 */
export function findRateForOrder(order: any, originRaw: string, rateMap: Record<string, any>) {
    const origin = (originRaw || 'TAIPING').toLowerCase();
    const zoneRaw = order.zone || order.delivery_address || 'Unknown';
    const calcZone = zoneRaw.toLowerCase();
    const key = `${origin}-${calcZone}`;
    let rateInfo = rateMap[key];

    if (!rateInfo && order.delivery_address) {
        const addrLower = order.delivery_address.toLowerCase();
        for (const k of Object.keys(rateMap)) {
            if (k.startsWith(`${origin}-`)) {
                const r = rateMap[k];
                const loc = (r.location_name || '').toLowerCase().trim();
                if (loc && loc.length >= 3 && addrLower.includes(loc)) {
                    rateInfo = r;
                    break;
                }
            }
        }
    }

    if (!rateInfo) {
        const matchedKey = Object.keys(rateMap).find(k => {
            if (!k.startsWith(`${origin}-`)) return false;
            const locName = k.slice(origin.length + 1);
            return locName.includes(calcZone) || (calcZone.length >= 3 && calcZone.includes(locName));
        });
        if (matchedKey) rateInfo = rateMap[matchedKey];
    }
    return rateInfo;
}

/**
 * Groups daily sales_orders into cohesive Trips
 */
export function groupOrdersIntoTrips(
    ordersForDay: any[],
    rateMap: Record<string, any>,
    dayLorryPlate?: string,
    driverLorryPlate?: string,
    lorriesList?: any[]
): GroupedTrip[] {
    if (!ordersForDay || ordersForDay.length === 0) return [];

    const groupsMap = new Map<string, any[]>();
    const extraJobOrders: any[] = [];

    ordersForDay.forEach(o => {
        const isExtraJob = o.job_type === 'Extra Job' || 
            o.job_type === 'Pick Up' ||
            (o.order_number && (o.order_number.startsWith('TRIP-JOB') || o.order_number.startsWith('TRIP-PU')));

        if (isExtraJob) {
            extraJobOrders.push(o);
        } else if (o.trip_id) {
            // Group by V2 trip_id
            const key = `trip_${o.trip_id}`;
            if (!groupsMap.has(key)) groupsMap.set(key, []);
            groupsMap.get(key)!.push(o);
        } else {
            // Group by explicit trip tag or sequence from notes
            const extracted = extractTripIdentifier(o.notes);
            const isExplicitSeq = o.tripSequence && o.tripSequence !== 999 
                ? o.tripSequence 
                : (o.trip_sequence && o.trip_sequence !== 999 ? o.trip_sequence : null);
            const tripTag = extracted.tripTag || (isExplicitSeq ? `Trip ${isExplicitSeq}` : null);

            if (tripTag) {
                const dateKey = (o.deadline || o.deliveryDate || o.order_date || o.created_at || '').slice(0, 10);
                const key = `manual_${dateKey ? `${dateKey}_` : ''}${tripTag.toLowerCase().replace(/\s+/g, '_')}`;
                if (!groupsMap.has(key)) groupsMap.set(key, []);
                groupsMap.get(key)!.push(o);
            } else {
                // If neither trip_id nor trip tag is present, treat as individual order trip
                const key = `order_${o.id}`;
                groupsMap.set(key, [o]);
            }
        }
    });

    const result: GroupedTrip[] = [];

    // Process grouped regular delivery trips
    groupsMap.forEach(orders => {
        // Sort orders by stop_sequence if available
        orders.sort((a, b) => {
            const stopA = (a.stop_sequence !== undefined && a.stop_sequence !== null && a.stop_sequence !== 999) ? a.stop_sequence : 999;
            const stopB = (b.stop_sequence !== undefined && b.stop_sequence !== null && b.stop_sequence !== 999) ? b.stop_sequence : 999;
            if (stopA !== stopB) return stopA - stopB;
            return String(a.order_number || a.orderNumber || '').localeCompare(String(b.order_number || b.orderNumber || ''));
        });

        const primary = orders[0];
        const orderIds = orders.map(o => o.id);
        const orderNumbers = Array.from(new Set(orders.map(o => o.order_number || o.orderNumber).filter(Boolean))).join(', ');
        const customers = Array.from(new Set(orders.map(o => o.customer).filter(Boolean))).join(', ');
        const combinedItems = orders.flatMap(o => o.items || []);

        // Filter active non-cancelled orders for drop calculations
        const activeOrders = orders.filter(o => o.status !== 'Cancelled' && o.status !== 'cancelled');
        const activeCount = activeOrders.length > 0 ? activeOrders.length : orders.length;

        // Total drops for trip: check explicit trip_drop_count recorded across orders
        const explicitDropCounts = (activeOrders.length > 0 ? activeOrders : orders)
            .map(o => Number(o.trip_drop_count))
            .filter(d => Boolean(d) && d > 0);
        
        const allSameExplicit = explicitDropCounts.length > 0 && explicitDropCounts.every(d => d === explicitDropCounts[0]);
        let tripDrops = activeCount;
        if (allSameExplicit && explicitDropCounts[0] > 1) {
            // Explicit multi-drop setting from admin (e.g. 4 orders recalibrated to 3 drops, or 1 order with 4 drops)
            tripDrops = explicitDropCounts[0];
        } else if (activeCount === 1 && explicitDropCounts.length === 1) {
            tripDrops = explicitDropCounts[0];
        } else if (explicitDropCounts.length > 0) {
            tripDrops = Math.max(activeCount, ...explicitDropCounts);
        } else {
            tripDrops = Math.max(1, activeCount);
        }

        // Origin: first non-empty origin
        const originRaw = orders.find(o => o.trip_origin)?.trip_origin || primary.trip_origin || 'TAIPING';

        // Select the rate that gives highest base rate among the orders (furthest / primary destination)
        let bestRateInfo: any = null;
        let bestBaseRate = -1;
        let bestZone = primary.zone || primary.delivery_address || 'Unknown';

        for (const o of orders) {
            const r = findRateForOrder(o, originRaw, rateMap);
            const curBase = r ? Number(r.base_rate) || 0 : 40;
            if (curBase > bestBaseRate) {
                bestBaseRate = curBase;
                bestRateInfo = r;
                bestZone = o.zone || o.delivery_address || 'Unknown';
            }
        }

        // Check if any order in the trip has an approved amount override
        let approvedAmount: number | null = null;
        for (const o of orders) {
            const m = o.notes?.match(/\[APPROVED_AMOUNT:\s*([\d.]+)\]/);
            if (m) {
                approvedAmount = parseFloat(m[1]) || null;
                break;
            }
        }

        let baseRate = 0;
        let extraRatePerPlace = 0;
        let extraDrops = 0;
        let extraDropTotal = 0;
        let tEarnings = 0;

        if (approvedAmount !== null) {
            tEarnings = approvedAmount;
            baseRate = approvedAmount;
        } else if (bestRateInfo) {
            baseRate = Number(bestRateInfo.base_rate) || 0;
            extraRatePerPlace = Number(bestRateInfo.extra_rate_per_place ?? bestRateInfo.extra_drop_rate) || 0;
            const maxPlaces = (bestRateInfo.max_places !== undefined && bestRateInfo.max_places !== null) ? Number(bestRateInfo.max_places) : 1;
            extraDrops = Math.max(0, tripDrops - maxPlaces);
            extraDropTotal = extraDrops * extraRatePerPlace;
            tEarnings = baseRate + extraDropTotal;
        } else {
            baseRate = 40;
            extraRatePerPlace = 10;
            extraDrops = Math.max(0, tripDrops - 1);
            extraDropTotal = extraDrops * extraRatePerPlace;
            tEarnings = baseRate + extraDropTotal;
        }

        // Determine aggregated status
        const nonCancelled = orders.filter(o => o.status !== 'Cancelled' && o.status !== 'cancelled');
        
        // Count total completed drops from POD photos across orders
        const totalCompletedDrops = orders.reduce((sum, o) => {
            const rawPod = o.pod_photo_url ? o.pod_photo_url.split(',') : [];
            let c = 0;
            for (let i = 0; i < rawPod.length; i += 2) {
                if ((rawPod[i] && rawPod[i].trim()) || (rawPod[i + 1] && rawPod[i + 1].trim())) {
                    c++;
                }
            }
            return sum + c;
        }, 0);

        const allDbDelivered = nonCancelled.length > 0 && nonCancelled.every(o => o.status === 'Delivered');
        const areAllDropsDone = allDbDelivered || tripDrops <= 1 || totalCompletedDrops >= tripDrops;
        const isAllDelivered = allDbDelivered || (nonCancelled.length > 0 && areAllDropsDone && nonCancelled.every(o => o.status === 'Delivered'));
        const isAnyTransit = orders.some(o => o.status === 'In-Transit');
        const isAnyLoaded = orders.some(o => o.status === 'Loaded') || (!allDbDelivered && !areAllDropsDone && nonCancelled.length > 0);
        const isAnyPending = orders.some(o => o.status === 'Pending Approval' || o.status === 'Pending');

        let status = primary.status;
        if (isAllDelivered) status = 'Delivered';
        else if (isAnyTransit) status = 'In-Transit';
        else if (isAnyLoaded) status = 'Loaded';
        else if (isAnyPending) status = 'Pending Approval';
        else if (orders.every(o => o.status === 'Cancelled')) status = 'Cancelled';

        const isDelivered = status === 'Delivered';
        const isUnscanned = status !== 'Delivered' && status !== 'Cancelled';

        // Lorry plate resolution
        const lorryId = orders.find(o => o.lorry_id)?.lorry_id || primary.lorry_id || null;
        let tripPlate = dayLorryPlate || driverLorryPlate || 'N/A';
        if (lorryId && lorriesList && lorriesList.length > 0) {
            const found = lorriesList.find((l: any) => l.id === lorryId);
            if (found?.plate_number || found?.plate) {
                tripPlate = found.plate_number || found.plate;
            }
        }

        const isDriverConfirmed = nonCancelled.length > 0 && nonCancelled.every(o => 
            o.notes?.includes('[DRIVER_CONFIRMED') || o.driver_confirmed === true || o.driver_verified === true
        );

        const dropsLabel = `${tripDrops} Drop${tripDrops > 1 ? 's' : ''}`;
        const dosLabel = orders.length > 1 ? ` • ${orders.length} DOs` : '';
        const displayString = `${originRaw} ➞ ${bestZone} (${dropsLabel}${dosLabel})`;

        // Combined notes, preserving pending payload from any order
        const pendingPayloadOrder = orders.find(o => o.notes?.includes('[PENDING_EDIT_PAYLOAD]') || o.pending_edit_payload);
        const combinedNotes = pendingPayloadOrder?.notes || primary.notes || null;

        result.push({
            id: primary.id,
            order_ids: orderIds,
            trip_id: primary.trip_id || null,
            order_number: orderNumbers || '-',
            customer: customers || '-',
            items: combinedItems,
            notes: combinedNotes,
            status,
            job_type: primary.job_type,
            pod_photo_url: primary.pod_photo_url || null,
            pod_signature_url: primary.pod_signature_url || null,
            proof_of_load_url: primary.proof_of_load_url || null,
            driver_id: primary.driver_id || null,
            lorry_id: lorryId,
            lorry_plate: tripPlate,
            trip_origin: originRaw,
            zone: bestZone,
            trip_drop_count: tripDrops,
            delivery_address: primary.delivery_address || null,
            edit_status: primary.edit_status || null,
            pending_edit_payload: pendingPayloadOrder?.pending_edit_payload || null,
            driver_confirmed: isDriverConfirmed,
            baseRate,
            extraRate: extraDropTotal,
            extraRatePerPlace,
            extraDrops,
            earnings: tEarnings,
            deadline: primary.deadline || null,
            pod_timestamp: primary.pod_timestamp || null,
            pod_signed_by: primary.pod_signed_by || null,
            isDelivered,
            isUnscanned,
            displayString,
            orders
        });
    });

    // Process Extra Jobs
    extraJobOrders.forEach(o => {
        const drops = Math.max(1, Number(o.trip_drop_count) || 1);
        const approvedMatch = o.notes?.match(/\[APPROVED_AMOUNT:\s*([\d.]+)\]/);
        const approvedAmount = approvedMatch ? parseFloat(approvedMatch[1]) : null;
        const earnings = approvedAmount !== null ? approvedAmount : 40;

        const iconMap: Record<string, string> = {
            'AMBIK PALLET': '🪵',
            'LORRY SERVICE': '🔧',
            'SHOPEE': '🛍️',
            'RETURN': '↩️',
            'OTHER': '🛠️'
        };
        const icon = iconMap[o.zone?.toUpperCase()] || '📸';
        const displayString = `${icon} ${o.zone || 'Extra Job'}`;

        const isDelivered = o.status === 'Delivered';
        const isUnscanned = o.status !== 'Delivered' && o.status !== 'Cancelled';
        const tripPlate = (o.lorry_id && lorriesList?.find((l: any) => l.id === o.lorry_id)?.plate_number) || dayLorryPlate || driverLorryPlate || 'N/A';

        result.push({
            id: o.id,
            order_ids: [o.id],
            trip_id: o.trip_id || null,
            order_number: o.order_number || o.orderNumber || '-',
            customer: o.customer || 'Extra Job',
            items: o.items || [],
            notes: o.notes || null,
            status: o.status,
            job_type: o.job_type || 'Extra Job',
            pod_photo_url: o.pod_photo_url || null,
            pod_signature_url: o.pod_signature_url || null,
            proof_of_load_url: o.proof_of_load_url || null,
            driver_id: o.driver_id || null,
            lorry_id: o.lorry_id || null,
            lorry_plate: tripPlate,
            trip_origin: o.trip_origin || 'TAIPING',
            zone: o.zone || 'Extra Job',
            trip_drop_count: drops,
            delivery_address: o.delivery_address || null,
            edit_status: o.edit_status || null,
            pending_edit_payload: o.pending_edit_payload || null,
            driver_confirmed: Boolean(o.notes?.includes('[DRIVER_CONFIRMED') || o.driver_confirmed === true || o.driver_verified === true),
            baseRate: earnings,
            extraRate: 0,
            extraRatePerPlace: 0,
            extraDrops: 0,
            earnings,
            deadline: o.deadline || null,
            pod_timestamp: o.pod_timestamp || null,
            pod_signed_by: o.pod_signed_by || null,
            isDelivered,
            isUnscanned,
            displayString,
            orders: [o]
        });
    });

    return result;
}
