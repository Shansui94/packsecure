import fs from 'fs';

const content = fs.readFileSync('src/pages/DeliveryOrderManagement.tsx', 'utf-8');
const lines = content.split('\n');

console.log("Searching for lorry or vehicle dropdown / filters in DeliveryOrderManagement.tsx...");
lines.forEach((line, idx) => {
    const lower = line.toLowerCase();
    if (lower.includes('lorry') || lower.includes('vehicle') || lower.includes('driver')) {
        if (line.includes('select') || line.includes('option') || line.includes('filter') || line.includes('map') || line.includes('disabled') || line.includes('onChange')) {
            console.log(`Line ${idx+1}: ${line.trim()}`);
        }
    }
});
