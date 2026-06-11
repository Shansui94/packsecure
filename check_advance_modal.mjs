import * as fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('isAdvanceModalOpen') || line.includes('IsAdvanceModalOpen')) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
});
