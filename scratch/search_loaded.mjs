import fs from 'fs';

const content = fs.readFileSync('src/pages/OrderSummary.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('status') || line.includes('update')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
