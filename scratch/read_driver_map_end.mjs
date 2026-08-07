import fs from 'fs';
const file = 'src/pages/DriverDelivery.tsx';
if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    for (let i = 1600; i < 1650; i++) {
        console.log(`${i+1}: ${lines[i]}`);
    }
}
