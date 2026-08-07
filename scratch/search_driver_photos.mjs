import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
    const lower = line.toLowerCase();
    if (lower.includes('photo') || lower.includes('pod') || lower.includes('image') || lower.includes('delivery_status')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
