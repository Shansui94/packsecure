import fs from 'fs';
import path from 'path';

function searchInterface(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            searchInterface(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('interface SalesOrder') || content.includes('type SalesOrder')) {
                console.log(`Found SalesOrder in file: ${fullPath}`);
                const lines = content.split('\n');
                lines.forEach((line, index) => {
                    if (line.includes('SalesOrder')) {
                        console.log(`  Line ${index + 1}: ${line.trim()}`);
                    }
                });
            }
        }
    });
}

searchInterface('src');
