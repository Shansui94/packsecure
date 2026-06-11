import fs from 'fs';

const content = fs.readFileSync('src/pages/HRPortal.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== Lines 260 to 310 ===");
for (let i = 259; i < Math.min(lines.length, 310); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
