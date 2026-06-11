import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR isScannerOpen IN DriverDelivery.tsx ===");
lines.forEach((line, idx) => {
    if (line.includes('isScannerOpen')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
