import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR FUNCTIONS IN DriverDelivery.tsx ===");
lines.forEach((line, idx) => {
    if (line.includes('const ') && (line.includes('async') || line.includes('=>') || line.includes('function'))) {
        if (line.includes('Trip') || line.includes('trip') || line.includes('Delivery') || line.includes('delivery') || line.includes('status') || line.includes('Status') || line.includes('finish') || line.includes('complete') || line.includes('Complete') || line.includes('Selesai') || line.includes('selesai')) {
            console.log(`${idx + 1}: ${line.trim()}`);
        }
    }
});
