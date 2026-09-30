import 'dotenv/config';
import { resolveDeliveryRate } from '../src/utils/aiDriverPricing';
import { groupOrdersIntoTrips } from '../src/utils/tripGrouping';

console.log('====================================================');
console.log('🧪 PACKSECURE DRIVER PRICING ENGINE VERIFICATION SUITE');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(desc: string, actual: any, expected: any) {
    if (actual === expected) {
        console.log(`✅ [PASS] ${desc} === ${actual}`);
        passCount++;
    } else {
        console.error(`❌ [FAIL] ${desc}: Expected ${expected}, got ${actual}`);
        failCount++;
    }
}

// TEST 1: Taufik Kelantan multi-drop
const t1 = resolveDeliveryRate({
    addresses: ['Kota Bharu', 'Pasir Mas', 'Tanah Merah', 'Gual Nering', 'Tumpat'],
    dropCount: 5,
    origin: 'TAIPING'
});
assert('T1: Kelantan Base Rate', t1.baseRate, 380);
assert('T1: Kelantan Max Places', t1.maxPlaces, 3);
assert('T1: Kelantan Extra Drops', t1.extraDrops, 2);
assert('T1: Kelantan Total AI Rate', t1.aiRate, 410);

// TEST 2: Dean Perlis trip with Kedah intermediate stops
const t2 = resolveDeliveryRate({
    addresses: ['Alor Setar, Kedah', 'Kangar, Perlis', 'Arau, Perlis', 'Kodiang'],
    dropCount: 4,
    origin: 'TAIPING'
});
assert('T2: Perlis Furthest Destination Base Rate', t2.baseRate, 165);
assert('T2: Perlis Max Places', t2.maxPlaces, 3);
assert('T2: Perlis Extra Drops', t2.extraDrops, 1);
assert('T2: Perlis Total AI Rate (165 + 5)', t2.aiRate, 170);

// TEST 3: Sam KL Subang Jaya single drop
const t3 = resolveDeliveryRate({
    addresses: ['Subang Jaya, Selangor'],
    dropCount: 1,
    origin: 'TAIPING'
});
assert('T3: KL Single Drop Base Rate', t3.baseRate, 250);
assert('T3: KL Single Drop Extra Drops', t3.extraDrops, 0);
assert('T3: KL Single Drop Total AI Rate', t3.aiRate, 250);

// TEST 4: Nilai to KL
const t4 = resolveDeliveryRate({
    addresses: ['Shah Alam, Selangor'],
    dropCount: 1,
    origin: 'NILAI'
});
assert('T4: Nilai to KL Base Rate', t4.baseRate, 80);

// TEST 5: Johor Weheng to Muar
const t5 = resolveDeliveryRate({
    addresses: ['Muar, Johor', 'Tangkak, Johor'],
    dropCount: 2,
    origin: 'JOHOR'
});
assert('T5: Johor to Muar Base Rate', t5.baseRate, 120);
assert('T5: Johor to Muar Extra Drops', t5.extraDrops, 1);
assert('T5: Johor to Muar Total (120 + 10)', t5.aiRate, 130);

// TEST 6: Grouping unlinked orders for same driver on same day (Eliminate duplicate Base Rates!)
const testDayOrders = [
    {
        id: 'ord-1',
        order_number: 'DO-001',
        driver_id: 'drv-taufik',
        delivery_address: 'Menglembu, Ipoh',
        deadline: '2026-09-28',
        status: 'Delivered'
    },
    {
        id: 'ord-2',
        order_number: 'DO-002',
        driver_id: 'drv-taufik',
        delivery_address: 'Bercham, Ipoh',
        deadline: '2026-09-28',
        status: 'Delivered'
    },
    {
        id: 'ord-3',
        order_number: 'DO-003',
        driver_id: 'drv-taufik',
        delivery_address: 'Batu Gajah, Perak',
        deadline: '2026-09-28',
        status: 'Delivered'
    }
];

const grouped = groupOrdersIntoTrips(testDayOrders, {}, 'PKD 8888', 'PKD 8888', []);
assert('T6: Unlinked orders grouped into exactly 1 trip', grouped.length, 1);
assert('T6: Total orders in trip', grouped[0].order_ids.length, 3);
assert('T6: Base rate charged only ONCE', grouped[0].baseRate, 80);
assert('T6: Trip total earnings (Ipoh 3 drops included)', grouped[0].earnings, 80);

// TEST 7: Special extra jobs (Ambil Pallet, Lorry Service, Taiping Trip, Shopee/SPD)
const palletJob = [
    {
        id: 'job-1',
        order_number: 'TRIP-JOB-01',
        job_type: 'Extra Job',
        zone: 'AMBIL PALLET',
        status: 'Delivered'
    }
];
const groupedPallet = groupOrdersIntoTrips(palletJob, {});
assert('T7: Ambil Pallet earnings', groupedPallet[0].earnings, 10);

const serviceJob = [
    {
        id: 'job-2',
        order_number: 'TRIP-JOB-02',
        job_type: 'Extra Job',
        notes: 'LORRY SERVICE PUSPAKOM',
        status: 'Delivered'
    }
];
const groupedService = groupOrdersIntoTrips(serviceJob, {});
assert('T7: Lorry Service earnings', groupedService[0].earnings, 15);

// TEST 8: Real Production Trip Multi-Drop AUTO_MATCH Compliance
// Scenario from User Screenshot: Trip #393 (Ayam) - Nilai to KL 9 drops (1 base + 8 extra)
const t8 = resolveDeliveryRate({
    addresses: ['Cheras, KL', 'Subang Jaya, Selangor', 'Petaling Jaya', 'Shah Alam', 'Klang', 'Kajang', 'Bangi', 'Puchong', 'Cyberjaya'],
    dropCount: 9,
    origin: 'NILAI',
    lorryPlate: 'VCH 2311'
});
assert('T8: Trip 393 Nilai to KL Base', t8.baseRate, 80);
assert('T8: Trip 393 Extra Drops (9 - 1 = 8)', t8.extraDrops, 8);
assert('T8: Trip 393 Extra Earnings (8 * 10)', t8.extraEarnings, 80);
assert('T8: Trip 393 Total AI Rate (80 + 80)', t8.aiRate, 160);
assert('T8: Trip 393 Discrepancy Level is AUTO_MATCH (Not Error!)', t8.discrepancyLevel, 'AUTO_MATCH');

// Scenario: Trip #272 (Mahadi) - Nilai to Batu Pahat / Kluang 8 drops (2 base + 6 extra)
const t9 = resolveDeliveryRate({
    addresses: ['Kluang, Johor', 'Batu Pahat, Johor'],
    dropCount: 8,
    origin: 'NILAI',
    lorryPlate: 'JTL 4321'
});
assert('T9: Trip 272 Base Rate', t9.baseRate, 200);
assert('T9: Trip 272 Extra Drops (8 - 2 = 6)', t9.extraDrops, 6);
assert('T9: Trip 272 Total AI Rate (200 + 60)', t9.aiRate, 260);
assert('T9: Trip 272 Discrepancy Level is AUTO_MATCH', t9.discrepancyLevel, 'AUTO_MATCH');

// TEST 10: Anomaly Interception Guardrails
// 10.1: Completely Unrecognized Address Fallback -> HIGH_DISCREPANCY
const t10_1 = resolveDeliveryRate({
    addresses: ['Plaza Unknown XYZ 123 Mars Station'],
    dropCount: 1,
    origin: 'NILAI',
    lorryPlate: 'VCH 2311'
});
assert('T10.1: Unrecognized address flagged as HIGH_DISCREPANCY', t10_1.discrepancyLevel, 'HIGH_DISCREPANCY');

// 10.2: Extreme Surge Rate > RM 650 -> HIGH_DISCREPANCY
const t10_2 = resolveDeliveryRate({
    addresses: ['Shah Alam, Selangor'],
    dropCount: 65, // 80 + 64*10 = 720 > 650
    origin: 'NILAI',
    lorryPlate: 'VCH 2311'
});
assert('T10.2: Extreme surge rate > RM 650 flagged as HIGH_DISCREPANCY', t10_2.discrepancyLevel, 'HIGH_DISCREPANCY');

// 10.3: Existing Approved Amount Divergence -> HIGH_DISCREPANCY
const t10_3 = resolveDeliveryRate({
    addresses: ['Shah Alam, Selangor'],
    dropCount: 1,
    origin: 'NILAI',
    lorryPlate: 'VCH 2311',
    existingApprovedAmount: 50 // Standard is 80, diff is 30 > 15
});
assert('T10.3: Existing approved divergence flagged as HIGH_DISCREPANCY', t10_3.discrepancyLevel, 'HIGH_DISCREPANCY');

console.log('\n====================================================');
console.log(`🏁 SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
console.log('====================================================\n');

if (failCount > 0) {
    process.exit(1);
}
