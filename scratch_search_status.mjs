import * as fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf-8');
const lines = content.split('\n');

console.log("Searching for setIsFinalDrop in DriverDelivery.tsx...");
lines.forEach((line, index) => {
    if (line.includes('setIsFinalDrop')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
