import fs from 'fs';
const file = 'src/pages/LorryManagement.tsx';
if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    for (let i = 150; i < 250; i++) {
        console.log(`${i+1}: ${lines[i]}`);
    }
}
