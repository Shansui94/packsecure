import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== Lines 880 to 910 ===");
for (let i = 879; i < Math.min(lines.length, 910); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
