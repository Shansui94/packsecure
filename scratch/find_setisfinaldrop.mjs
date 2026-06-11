import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR setIsFinalDrop ===");
lines.forEach((line, idx) => {
    if (line.includes('setIsFinalDrop')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
