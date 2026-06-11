import fs from 'fs';

const content = fs.readFileSync('src/pages/HRPortal.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== HRPortal.tsx lines 520 to 600 ===");
for (let i = 519; i < Math.min(lines.length, 600); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
