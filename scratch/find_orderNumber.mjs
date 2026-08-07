import fs from 'fs';

const filePath = 'c:\\Users\\Max Tan\\Downloads\\Packsecure OS\\packsecure\\src\\pages\\DeliveryOrderManagement.tsx';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

const occurrences = [];
lines.forEach((line, idx) => {
    if (line.includes('orderNumber') || line.includes('order_number') || line.includes('pod_photo_url')) {
        occurrences.push({ lineNum: idx + 1, content: line.trim() });
    }
});

console.log(`Found ${occurrences.length} occurrences:`);
occurrences.forEach(o => {
    console.log(`Line ${o.lineNum}: ${o.content}`);
});
