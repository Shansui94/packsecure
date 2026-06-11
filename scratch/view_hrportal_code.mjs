import fs from 'fs';

const content = fs.readFileSync('src/pages/HRPortal.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== Lines 1045 to 1075 ===");
for (let i = 1044; i < 1075; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}

console.log("\n=== Lines 1125 to 1170 ===");
for (let i = 1124; i < 1170; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
