import fs from 'fs';

const content = fs.readFileSync('src/pages/HRPortal.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== Lines 1165 to 1195 ===");
for (let i = 1164; i < Math.min(lines.length, 1195); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
