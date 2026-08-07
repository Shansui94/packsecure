const fs = require('fs');
const path = require('path');

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

walkDir('c:/Users/Max Tan/Downloads/Packsecure OS/packsecure/src', (filePath) => {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('Phy:') || content.includes('current_stock')) {
            console.log(`Found in: ${filePath}`);
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (line.includes('Phy:') || line.includes('current_stock')) {
                    console.log(`  Line ${idx + 1}: ${line.trim()}`);
                }
            });
        }
    }
});
