import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== Lines 1610 to 1650 ===");
for (let i = 1609; i < Math.min(lines.length, 1650); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
