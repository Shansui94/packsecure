import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes("SCANNER MODAL")) - 1;
const endIndex = startIndex + 32;

console.log(`=== Lines ${startIndex + 1} to ${endIndex + 1} ===`);
for (let i = startIndex; i < endIndex; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
