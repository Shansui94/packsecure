import fs from 'fs';

const content = fs.readFileSync('SOP_Driver_Delivery.md', 'utf8');
const lines = content.split('\n');

console.log("=== Lines 40 to 80 ===");
for (let i = 39; i < Math.min(lines.length, 80); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
