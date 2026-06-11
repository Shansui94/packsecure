import fs from 'fs';

const content = fs.readFileSync('src/pages/HRPortal.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== Lines 110 to 140 ===");
for (let i = 109; i < Math.min(lines.length, 140); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
