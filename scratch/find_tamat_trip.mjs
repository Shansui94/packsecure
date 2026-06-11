import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR Tamat OR Complete in DriverDelivery.tsx ===");
lines.forEach((line, idx) => {
    if (line.includes('Tamat') || line.includes('tamat') || line.includes('Complete') || line.includes('complete')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
