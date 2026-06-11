import * as fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');
// Print lines from 480 to 550
for (let i = 480; i < 550; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
