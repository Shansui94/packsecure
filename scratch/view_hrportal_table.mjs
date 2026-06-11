import fs from 'fs';

const content = fs.readFileSync('src/pages/HRPortal.tsx', 'utf8');
const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes("'Employee', 'Role', 'Pay Type'")) - 5;
const endIndex = startIndex + 15;

console.log(`=== Lines ${startIndex + 1} to ${endIndex + 1} ===`);
for (let i = startIndex; i < endIndex; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
