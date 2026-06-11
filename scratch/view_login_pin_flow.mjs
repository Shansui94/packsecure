import fs from 'fs';

const content = fs.readFileSync('src/pages/Login.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== Lines 100 to 200 of Login.tsx ===");
for (let i = 99; i < Math.min(lines.length, 200); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
