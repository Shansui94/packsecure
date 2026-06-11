import fs from 'fs';

const content = fs.readFileSync('src/pages/HRPortal.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== Lines 1070 to 1120 ===");
for (let i = 1069; i < Math.min(lines.length, 1120); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
