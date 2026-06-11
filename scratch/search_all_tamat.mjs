import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR MALAY TERMS FOR FINISHING OR COMPLETING ===");
lines.forEach((line, idx) => {
    if (line.includes('Tamat') || line.includes('tamat') || line.includes('Selesai') || line.includes('selesai') || line.includes('Trip') || line.includes('trip')) {
        if (line.includes('button') || line.includes('onClick') || line.includes('<button') || line.includes('Text') || line.includes('text') || line.includes('Confirm') || line.includes('confirm')) {
            console.log(`${idx + 1}: ${line.trim()}`);
        }
    }
});
