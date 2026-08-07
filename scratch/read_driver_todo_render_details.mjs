import fs from 'fs';
const file = 'src/pages/DriverDelivery.tsx';
if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    for (let i = 1450; i < 1610; i++) {
        console.log(`${i+1}: ${lines[i]}`);
    }
}
