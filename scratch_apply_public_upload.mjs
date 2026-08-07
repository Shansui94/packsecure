import * as fs from 'fs';
import * as path from 'path';

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            if (f !== 'node_modules' && f !== '.git' && f !== 'dist') {
                walkDir(dirPath, callback);
            }
        } else {
            callback(dirPath);
        }
    });
}

console.log("Searching for 'Delivered' status assignments in workspace...");
walkDir('.', filePath => {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.sql')) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes('Delivered') && (content.includes('status') || content.includes('update') || content.includes('UPDATE'))) {
            console.log(`Found in: ${filePath}`);
            const lines = content.split('\n');
            lines.forEach((line, index) => {
                const lower = line.toLowerCase();
                if (line.includes('Delivered') && (lower.includes('status') || lower.includes('update'))) {
                    console.log(`  Line ${index + 1}: ${line.trim()}`);
                }
            });
        }
    }
});
