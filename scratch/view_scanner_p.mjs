import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== Lines 1690 to 1715 ===");
for (let i = 1689; i < Math.min(lines.length, 1715); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
