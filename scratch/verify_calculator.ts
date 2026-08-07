import { calculateShiftSplit, getRatesForTarget, DEFAULT_RATES } from '../src/utils/rateCalculator';

console.log("=== Testing Rate Calculator & Time Split Logic ===");

// Test Case 1: Shift from 06:00 to 14:00 (MYT) on T1-M03
// 06:00-08:00 (2h Night @ RM15) + 08:00-14:00 (6h Day @ RM10) = 2*15 + 6*10 = RM90
const shift1 = calculateShiftSplit('2026-08-03T06:00:00+08:00', '2026-08-03T14:00:00+08:00', 8);
console.log('Shift 1 (06:00-14:00 MYT):', shift1);

const ratesT1 = getRatesForTarget('T1-M03', new Map());
const pay1 = (shift1.nightHours * ratesT1.night_rate) + (shift1.dayHours * ratesT1.day_rate);
console.log('Shift 1 Pay (T1-M03): RM', pay1, '(Expected RM90.00)');

// Test Case 2: Shift 1M Single Layer (T3-M02) from 00:00 to 08:00 (8h Night @ RM13) = RM104
const shift2 = calculateShiftSplit('2026-08-03T00:00:00+08:00', '2026-08-03T08:00:00+08:00', 8);
const ratesT3 = getRatesForTarget('T3-M02', new Map());
const pay2 = (shift2.nightHours * ratesT3.night_rate) + (shift2.dayHours * ratesT3.day_rate);
console.log('Shift 2 Pay (T3-M02 00:00-08:00): RM', pay2, '(Expected RM104.00)');

// Test Case 3: Factory Login Option 1 (FACTORY_MODE_1) from 06:00 to 14:00 (2h Night @ RM12 + 6h Day @ RM8) = 24 + 48 = RM72
const ratesFac1 = getRatesForTarget('FACTORY_MODE_1', new Map());
const pay3 = (shift1.nightHours * ratesFac1.night_rate) + (shift1.dayHours * ratesFac1.day_rate);
console.log('Shift 3 Pay (Factory Mode 1 06:00-14:00): RM', pay3, '(Expected RM72.00)');

// Test Case 4: Factory Login Option 2 (FACTORY_MODE_2) from 06:00 to 14:00 (8h @ RM10) = RM80
const ratesFac2 = getRatesForTarget('FACTORY_MODE_2', new Map());
const pay4 = (shift1.nightHours * ratesFac2.night_rate) + (shift1.dayHours * ratesFac2.day_rate);
console.log('Shift 4 Pay (Factory Mode 2 06:00-14:00): RM', pay4, '(Expected RM80.00)');

if (pay1 === 90 && pay2 === 104 && pay3 === 72 && pay4 === 80) {
    console.log("🎉 ALL CALCULATOR VERIFICATION TESTS PASSED 100% PERFECTLY!");
} else {
    console.error("❌ Calculation error detected.");
}
