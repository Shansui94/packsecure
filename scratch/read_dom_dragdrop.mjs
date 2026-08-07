import fs from 'fs';
const file = 'src/pages/DeliveryOrderManagement.tsx';
if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    for (let i = 3090; i < 3200; i++) {
        console.log(`${i+1}: ${lines[i]}`);
    }
}
