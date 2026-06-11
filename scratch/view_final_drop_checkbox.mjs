import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== Lines 1480 to 1540 ===");
for (let i = 1479; i < Math.min(lines.length, 1540); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
