import fs from 'fs';
const file = 'src/pages/DeliveryOrderManagement.tsx';
if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    for (let i = 3029; i < 3075; i++) {
        console.log(`${i+1}: ${lines[i]}`);
    }
}
