import fs from 'fs';

const content = fs.readFileSync('src/pages/DeliveryOrderManagement.tsx', 'utf8');
const lines = content.split('\n');

console.log("Inspecting lines around 3095:\n");
for (let i = -10; i <= 20; i++) {
    const lineNum = 3095 + i;
    if (lines[lineNum - 1]) {
        console.log(`  ${lineNum}: ${lines[lineNum - 1].trim()}`);
    }
}

console.log("\nInspecting lines around 3258:\n");
for (let i = -10; i <= 20; i++) {
    const lineNum = 3258 + i;
    if (lines[lineNum - 1]) {
        console.log(`  ${lineNum}: ${lines[lineNum - 1].trim()}`);
    }
}
