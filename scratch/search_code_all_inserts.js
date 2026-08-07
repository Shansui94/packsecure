import fs from 'fs';
import path from 'path';

function searchFiles(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            searchFiles(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes("from('sales_orders')") && (content.includes(".insert") || content.includes(".upsert"))) {
                console.log(`Found insert/upsert in File: ${fullPath}`);
                // Print matches with context
                const lines = content.split('\n');
                lines.forEach((line, index) => {
                    if (line.includes(".insert") || line.includes(".upsert")) {
                        console.log(`  Line ${index + 1}: ${line.trim()}`);
                    }
                });
            }
        }
    });
}

console.log("=== Recursive Search for sales_orders insert/upsert in src/ ===");
searchFiles('src');
