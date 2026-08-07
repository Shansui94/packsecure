import fs from 'fs';

const content = fs.readFileSync('src/pages/DeliveryOrderManagement.tsx', 'utf8');
const lines = content.split('\n');

console.log("Searching in DeliveryOrderManagement.tsx for 'Delivered':\n");

lines.forEach((line, index) => {
    if (line.includes("'Delivered'") || line.includes('"Delivered"')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
