import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== Lines 750 to 815 ===");
for (let i = 749; i < Math.min(lines.length, 815); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
