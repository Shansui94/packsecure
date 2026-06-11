import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== Lines 560 to 620 ===");
for (let i = 559; i < Math.min(lines.length, 620); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
