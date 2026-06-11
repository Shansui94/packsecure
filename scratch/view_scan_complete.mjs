import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== Lines 740 to 790 ===");
for (let i = 739; i < Math.min(lines.length, 790); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
