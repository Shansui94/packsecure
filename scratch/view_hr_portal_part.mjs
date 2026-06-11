import fs from 'fs';

const content = fs.readFileSync('src/pages/HRPortal.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== HRPortal.tsx lines 1180 to 1235 ===");
for (let i = 1179; i < 1235; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
