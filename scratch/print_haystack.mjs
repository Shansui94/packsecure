import fs from 'fs';

const filePath = 'c:\\Users\\Max Tan\\Downloads\\Packsecure OS\\packsecure\\src\\pages\\DeliveryOrderManagement.tsx';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes('function buildTripSearchHaystack'));
if (idx !== -1) {
    console.log(lines.slice(idx, idx + 20).join('\n'));
} else {
    console.log('Not found!');
}
