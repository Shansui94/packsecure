import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("Searching for handleOpenUnloadModal in DriverDelivery.tsx:\n");

lines.forEach((line, index) => {
    if (line.includes('handleOpenUnloadModal') || line.includes('openUnloadModal')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
        for (let i = 1; i <= 25; i++) {
            if (lines[index + i]) {
                console.log(`  +${i}: ${lines[index + i].trim()}`);
            }
        }
        console.log('----------------------------------------------------');
    }
});
