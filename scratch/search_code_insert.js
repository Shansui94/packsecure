import fs from 'fs';
import path from 'path';

const searchDir = 'src/pages';
const files = fs.readdirSync(searchDir);

console.log("Searching for '.from(\\'sales_orders\\')' in src/pages/:\n");

files.forEach(file => {
    if (!file.endsWith('.tsx') && !file.endsWith('.ts')) return;
    
    const filePath = path.join(searchDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes("from('sales_orders')")) {
        console.log(`File: ${file}`);
        
        // Let's find matches and print some context
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            if (line.includes("from('sales_orders')")) {
                console.log(`  Line ${index + 1}: ${line.trim()}`);
                // Print next 10 lines as context
                for (let i = 1; i <= 15; i++) {
                    if (lines[index + i]) {
                        console.log(`    +${i}: ${lines[index + i].trim()}`);
                    }
                }
                console.log('  --------------------------------------------');
            }
        });
    }
});
