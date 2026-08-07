import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("Searching in DriverDelivery.tsx for scan/scanner/QR references:\n");

lines.forEach((line, index) => {
    if (line.toLowerCase().includes('scan') || line.toLowerCase().includes('qr')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
