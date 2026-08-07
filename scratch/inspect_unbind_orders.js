import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("Inspecting unbind code in DriverDelivery.tsx:\n");

for (let i = 950; i <= 1010; i++) {
    if (lines[i - 1]) {
        console.log(`${i}: ${lines[i - 1].trim()}`);
    }
}
