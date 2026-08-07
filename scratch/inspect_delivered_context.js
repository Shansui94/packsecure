import fs from 'fs';

const content = fs.readFileSync('src/pages/DeliveryOrderManagement.tsx', 'utf8');
const lines = content.split('\n');

console.log("Inspecting lines around 1026 in DeliveryOrderManagement.tsx:\n");

for (let i = -15; i <= 20; i++) {
    const lineNum = 1026 + i;
    if (lines[lineNum - 1]) {
        console.log(`  ${lineNum}: ${lines[lineNum - 1].trim()}`);
    }
}
