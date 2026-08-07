import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("Searching for isUnloadModalOpen inside JSX in DriverDelivery.tsx:\n");

lines.forEach((line, index) => {
    if (line.includes('isUnloadModalOpen') && (line.includes('&&') || line.includes('?'))) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
        for (let i = 1; i <= 60; i++) {
            if (lines[index + i]) {
                console.log(`  +${i}: ${lines[index + i].trim()}`);
            }
        }
        console.log('----------------------------------------------------');
    }
});
