import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("Inspecting inserts in DriverDelivery.tsx:\n");

const targets = [910, 926, 960];
targets.forEach(target => {
    console.log(`Line ${target}:`);
    for (let i = -5; i <= 15; i++) {
        const lineNum = target + i;
        if (lines[lineNum - 1]) {
            console.log(`  ${lineNum}: ${lines[lineNum - 1].trim()}`);
        }
    }
    console.log('----------------------------------------------------');
});
