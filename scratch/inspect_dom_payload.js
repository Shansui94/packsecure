import fs from 'fs';

const content = fs.readFileSync('src/pages/DeliveryOrderManagement.tsx', 'utf8');
const lines = content.split('\n');

console.log("Searching for payload definition in DeliveryOrderManagement.tsx:\n");

lines.forEach((line, index) => {
    if (line.includes('const payload =') || line.includes('payload = {') || line.includes('const payload:')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
        for (let i = 1; i <= 25; i++) {
            if (lines[index + i]) {
                console.log(`  +${i}: ${lines[index + i].trim()}`);
            }
        }
        console.log('----------------------------------------------------');
    }
});
