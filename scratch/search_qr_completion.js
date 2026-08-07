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
            if (content.toLowerCase().includes('qr') && (content.toLowerCase().includes('complete') || content.toLowerCase().includes('delivered') || content.toLowerCase().includes('tamat'))) {
                const lines = content.split('\n');
                lines.forEach((line, index) => {
                    if (line.toLowerCase().includes('qr') && (line.toLowerCase().includes('complete') || line.toLowerCase().includes('finish') || line.toLowerCase().includes('tamat'))) {
                        console.log(`${fullPath}:${index + 1}: ${line.trim()}`);
                    }
                });
            }
        }
    });
}

searchFiles('src');
