import fs from 'fs';

const content = fs.readFileSync('src/pages/HRPortal.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== Lines 400 to 455 ===");
for (let i = 399; i < Math.min(lines.length, 455); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
