import fs from 'fs';
const file = 'src/pages/DeliveryOrderManagement.tsx';
if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    for (let i = 3280; i < 3360; i++) {
        console.log(`${i+1}: ${lines[i]}`);
    }
}
