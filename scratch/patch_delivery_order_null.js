import fs from 'fs';

const filePath = 'src/pages/DeliveryOrderManagement.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

const targetStr = `setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'New', driverId: null, driver_id: null } : o));`;
const replacementStr = `setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'New', driverId: undefined, driver_id: undefined } : o));`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log("TypeScript null compatibility patch applied!");
} else {
    console.error("Target string not found in DeliveryOrderManagement.tsx");
}
