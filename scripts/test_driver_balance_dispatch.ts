import {
    isShortDistanceTrip,
    calcDriverLastWorkEndTime,
    checkDriverRestEligibility,
    generateBalancedDriverAssignments,
    DEFAULT_DISPATCH_RULES,
    DispatchRuleConfig
} from '../src/utils/driverBalanceDispatch';

function runTests() {
    console.log("=== Starting Tests for Driver Balance & Rest Dispatch Engine ===");
    let passed = 0;
    let failed = 0;

    function assert(cond: boolean, name: string) {
        if (cond) {
            console.log(`✅ [PASS] ${name}`);
            passed++;
        } else {
            console.error(`❌ [FAIL] ${name}`);
            failed++;
        }
    }

    // Test 1: Short distance trip recognition
    const short1 = isShortDistanceTrip('TAIPING', 'Ipoh, Perak', 180, 250);
    assert(short1 === true, "Taiping to Ipoh with RM180 rate is short distance");

    const long1 = isShortDistanceTrip('TAIPING', 'Johor Bahru, Johor', 550, 250);
    assert(long1 === false, "Taiping to Johor with RM550 rate is long distance");

    // Test 2: Last work end time from shift log
    const now = new Date('2026-09-08T10:00:00+08:00');
    const shiftLogs = [
        { driver_id: 'd1', log_type: 'end', created_at: '2026-09-07T20:00:00+08:00' }
    ];
    const { workEndTime: wet1, source: s1 } = calcDriverLastWorkEndTime('d1', shiftLogs, [], [], DEFAULT_DISPATCH_RULES, now);
    assert(s1 === 'shift_log', "Work end time source is shift_log");
    assert(wet1?.toISOString() === new Date('2026-09-07T20:00:00+08:00').toISOString(), "Work end time matches shift log timestamp");

    // Test 3: Last work end time fallback to POD + return buffer
    const recentOrders = [
        { driver_id: 'd2', status: 'Delivered', pod_timestamp: '2026-09-07T17:00:00+08:00', delivery_address: 'Kuala Lumpur', trip_origin: 'TAIPING' }
    ];
    const { workEndTime: wet2, source: s2 } = calcDriverLastWorkEndTime('d2', [], [], recentOrders, DEFAULT_DISPATCH_RULES, now);
    assert(s2 === 'pod_fallback', "Work end time source is pod_fallback when no shift log");
    // 17:00 + 3.5h buffer = 20:30
    const expectedWet2 = new Date(new Date('2026-09-07T17:00:00+08:00').getTime() + 3.5 * 3600 * 1000);
    assert(wet2?.getTime() === expectedWet2.getTime(), "Work end time has 3.5h buffer for outstation fallback");

    // Test 4: 10h Rest Eligibility Check
    // d1 finished at 20:00 yesterday, now is 10:00 today -> 14 hours rest >= 10h -> eligible
    const elig1 = checkDriverRestEligibility('d1', '2026-09-08', false, wet1, [], [], DEFAULT_DISPATCH_RULES, now);
    assert(elig1.eligible === true, "Driver with 14h rest is eligible for long-haul trip");

    // Driver d_tired finished work at 04:00 today, now is 10:00 today -> 6 hours rest < 10h -> ineligible
    const tiredEndTime = new Date('2026-09-08T04:00:00+08:00');
    const eligTired = checkDriverRestEligibility('d_tired', '2026-09-08', false, tiredEndTime, [], [], DEFAULT_DISPATCH_RULES, now);
    assert(eligTired.eligible === false, "Driver with only 6h rest is ineligible (< 10h rest)");
    assert(eligTired.hasFatigueWarning === true, "Driver with 6h rest has fatigue warning");

    // Test 5: Daily Trip Limits (Long vs Short)
    // Long trip: cannot assign if driver already has 1 long trip today
    const existingLongTrips = [{ isShort: false }];
    const eligLongLimit = checkDriverRestEligibility('d1', '2026-09-08', false, null, existingLongTrips, [], DEFAULT_DISPATCH_RULES, now);
    assert(eligLongLimit.eligible === false, "Cannot assign 2nd long trip on the same day (max 1)");

    // Short trip: can assign up to 2 short trips per day
    const existingShortTrips1 = [{ isShort: true }];
    const eligShortTrip2 = checkDriverRestEligibility('d1', '2026-09-08', true, null, existingShortTrips1, [], DEFAULT_DISPATCH_RULES, now);
    assert(eligShortTrip2.eligible === true, "Can assign 2nd short trip on the same day");

    const existingShortTrips2 = [{ isShort: true }, { isShort: true }];
    const eligShortTrip3 = checkDriverRestEligibility('d1', '2026-09-08', true, null, existingShortTrips2, [], DEFAULT_DISPATCH_RULES, now);
    assert(eligShortTrip3.eligible === false, "Cannot assign 3rd short trip when maxShortTripsPerDay is 2");

    // Test 6: Balanced Driver Assignment (Greedy Water-Filling)
    // Driver A has RM 1,000 MTD, Driver B has RM 2,500 MTD.
    // Trip 1 (RM 500) and Trip 2 (RM 400) need assignment.
    // Both drivers are well-rested.
    // Trip 1 should go to Driver A (lower earnings: 1000 < 2500).
    // Now Driver A has 1500, Driver B has 2500.
    // Trip 2 should also go to Driver A (1500 < 2500) to balance towards Driver B!
    const mockDrivers = [
        { uid: 'dA', name: 'Driver A (Low)', base_location: 'Taiping' },
        { uid: 'dB', name: 'Driver B (High)', base_location: 'Taiping' }
    ];
    const mockMonthlyOrders = [
        { id: 'm1', driver_id: 'dA', status: 'Delivered', zone: 'Ipoh', trip_origin: 'TAIPING', trip_drop_count: 5 }, // ~RM 1000
        { id: 'm2', driver_id: 'dB', status: 'Delivered', zone: 'Johor', trip_origin: 'TAIPING', trip_drop_count: 5 }  // ~RM 2500
    ];
    const mockRates = [
        { origin: 'TAIPING', location_name: 'Ipoh', base_rate: 200, max_places: 1, extra_rate_per_place: 50 },
        { origin: 'TAIPING', location_name: 'Johor', base_rate: 500, max_places: 1, extra_rate_per_place: 100 },
        { origin: 'TAIPING', location_name: 'Penang', base_rate: 250, max_places: 1, extra_rate_per_place: 50 },
        { origin: 'TAIPING', location_name: 'KL', base_rate: 400, max_places: 1, extra_rate_per_place: 80 }
    ];
    const mockTrips = [
        {
            id: 't-1',
            name: 'Trip 1 - KL',
            factoryId: 'TAIPING',
            zone: 'KL',
            orders: [{ id: 'o1', customer: 'Cust 1', zone: 'KL', trip_origin: 'TAIPING', trip_drop_count: 2, deadline: '2026-09-08' }],
            totalVol: 10,
            totalWeight: 1000,
            isOverloaded: false
        },
        {
            id: 't-2',
            name: 'Trip 2 - Penang',
            factoryId: 'TAIPING',
            zone: 'Penang',
            orders: [{ id: 'o2', customer: 'Cust 2', zone: 'Penang', trip_origin: 'TAIPING', trip_drop_count: 1, deadline: '2026-09-09' }],
            totalVol: 8,
            totalWeight: 800,
            isOverloaded: false
        }
    ];

    const dispatchRes = generateBalancedDriverAssignments(
        mockTrips,
        mockDrivers,
        mockMonthlyOrders,
        mockRates,
        [], // no recent shifts, fully rested
        [],
        [],
        'Taiping',
        DEFAULT_DISPATCH_RULES
    );

    assert(dispatchRes.trips[0].recommendedDriverId === 'dA', "Highest paying trip correctly assigned to lower earning Driver A");
    assert(dispatchRes.trips[0].recommendationReason.includes('收入拉平'), "Trip recommendation reason notes earnings balancing");

    console.log("\n==========================================");
    console.log(`Results: ${passed} passed, ${failed} failed.`);
    console.log("==========================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
