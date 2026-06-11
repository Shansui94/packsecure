import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR handleUnbindLorry in render ===");
lines.forEach((line, idx) => {
    if (line.includes('handleUnbindLorry')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
