import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("Searching in DriverDelivery.tsx for updates to sales_orders:\n");

lines.forEach((line, index) => {
    if (line.includes("from('sales_orders')") && line.includes(".update")) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
        for (let i = 1; i <= 15; i++) {
            if (lines[index + i]) {
                console.log(`  +${i}: ${lines[index + i].trim()}`);
            }
        }
        console.log('----------------------------------------------------');
    }
});
