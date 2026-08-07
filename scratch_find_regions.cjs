const fs = require('fs');
const code = fs.readFileSync('c:/Users/Max Tan/Downloads/Packsecure OS/packsecure/src/pages/FactoryLiveOS.tsx', 'utf8');
const lines = code.split('\n');

for (let i = 800; i <= 830; i++) {
    console.log(`${i}: ${lines[i - 1]}`);
}
