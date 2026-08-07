import fs from 'fs';
const file = 'src/pages/DeliveryOrderManagement.tsx';
if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        if (line.includes("from('sales_orders')") || line.includes("sales_orders") && line.includes(".order(")) {
            console.log(`Line ${i+1}: ${line.trim()}`);
            // Print next 5 lines
            for (let j = 1; j <= 5; j++) {
                if (lines[i+j]) console.log(`   +${j}: ${lines[i+j].trim()}`);
            }
        }
    });
}
