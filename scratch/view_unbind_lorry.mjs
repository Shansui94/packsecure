import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== Lines 780 to 830 ===");
for (let i = 779; i < Math.min(lines.length, 830); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
