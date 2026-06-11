import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== Lines 500 to 560 ===");
for (let i = 499; i < Math.min(lines.length, 560); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
