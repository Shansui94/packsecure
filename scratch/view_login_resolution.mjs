import fs from 'fs';

const content = fs.readFileSync('src/pages/Login.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== Lines 60 to 105 of Login.tsx ===");
for (let i = 59; i < Math.min(lines.length, 105); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
