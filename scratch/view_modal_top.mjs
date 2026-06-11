import fs from 'fs';

const content = fs.readFileSync('src/pages/HRPortal.tsx', 'utf8');
const lines = content.split('\n');

for (let i = 112; i < 128; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
