import { calculateLoad } from '../src/utils/logistics';

// Mock items
const bubbleWrap100 = { sku: 'BW-SL-CLR-100Mx100CMx1ROLL-RED', quantity: 10 }; // 10 rolls of 100cm bubblewrap
// 10 rolls * 0.4489 m3/roll = 4.489 m3. Weight: 10 * 6.8 = 68kg.

const bubbleWrap50 = { sku: 'W50-ROLL', quantity: 10 }; // 10 rolls of 50cm bubblewrap
// 10 rolls * 0.22445 m3/roll = 2.2445 m3. Weight: 10 * 3.4 = 34kg.

const stretchFilm = { sku: 'SF-BLACK', quantity: 10 }; // 10 rolls of stretch film
// 10 rolls * 0.053248 m3/roll = 0.53248 m3. Weight: 10 * 14 = 140kg.

const otherItem = { sku: 'BOX-XYZ', quantity: 10 }; // 10 other items
// 10 items * 0.03375 m3/item = 0.3375 m3. Weight: 10 * 15 = 150kg.

const items = [bubbleWrap100, bubbleWrap50, stretchFilm, otherItem];
// Total Vol = 4.489 + 2.2445 + 0.53248 + 0.3375 = 7.60348 m3
// Total Weight = 68 + 34 + 140 + 150 = 392 kg

console.log("=== Loading items specs ===");
console.log(`Expected Volume: 7.60 m3 | Expected Weight: 392.00 kg`);

// Test cases for different lorries
const standardLorry = { plateNumber: 'DFK 9821' }; // Standard (82 rolls = 36.81m3)
const vpcLorry = { plateNumber: 'VPC 9821' }; // VPC (65 rolls = 29.18m3)
const aphLorry = { plateNumber: 'APH 9821' }; // APH (92 rolls = 41.30m3)
const customLorry = { plateNumber: 'XYZ 1234', maxVolumeM3: 10.0, maxWeightKg: 1000 }; // Custom DB configured limits
const noVehicle = null;

const resStd = calculateLoad(items, standardLorry);
const resVpc = calculateLoad(items, vpcLorry);
const resAph = calculateLoad(items, aphLorry);
const resCustom = calculateLoad(items, customLorry);
const resNone = calculateLoad(items, noVehicle);

console.log("\nStandard Lorry (82 rolls / 36.81 m3 limit):");
console.log(JSON.stringify(resStd, null, 2));

console.log("\nVPC Lorry (65 rolls / 29.18 m3 limit):");
console.log(JSON.stringify(resVpc, null, 2));

console.log("\nAPH Lorry (92 rolls / 41.30 m3 limit):");
console.log(JSON.stringify(resAph, null, 2));

console.log("\nCustom Lorry (DB configured 10.00 m3 / 1000 kg limits):");
console.log(JSON.stringify(resCustom, null, 2));

console.log("\nNo Lorry (Calculates totals with no percentages/status):");
console.log(JSON.stringify(resNone, null, 2));

// Test massive load to trigger overload
const massiveItems = [{ sku: 'BW-SL-CLR-100Mx100CMx1ROLL-RED', quantity: 70 }]; 
// 70 rolls * 0.4489 = 31.42 m3. Overloads VPC (limit 29.18m3) but fits Standard (limit 36.81m3) and APH (limit 41.30m3).

console.log("\n=== Testing Overload on VPC but not Standard/APH ===");
console.log(`Massive Volume: ${(70 * 0.4489).toFixed(2)} m3`);
console.log("Std Overloaded:", calculateLoad(massiveItems, standardLorry).isOverloaded);
console.log("VPC Overloaded:", calculateLoad(massiveItems, vpcLorry).isOverloaded);
console.log("APH Overloaded:", calculateLoad(massiveItems, aphLorry).isOverloaded);
console.log("Custom Lorry Overloaded (limit 10.00 m3):", calculateLoad(massiveItems, customLorry).isOverloaded);
