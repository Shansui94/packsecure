const fs = require('fs');
const code = fs.readFileSync('c:/Users/Max Tan/Downloads/Packsecure OS/packsecure/src/components/Layout.tsx', 'utf8');
const lines = code.split('\n');

for (let i = 1; i <= 250; i++) {
    if (lines[i - 1]) console.log(`${i}: ${lines[i - 1]}`);
}
