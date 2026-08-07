import fs from 'fs';
const file = 'src/pages/DeliveryOrderManagement.tsx';
if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    lines.forEach((line, i) => {
        if (line.includes('filteredOrders =') || line.includes('const filteredOrders') || line.includes('let filteredOrders')) {
            console.log(`${i+1}: ${line.trim()}`);
        }
    });
}
