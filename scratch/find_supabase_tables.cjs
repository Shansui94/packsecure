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

const tables = new Set();
walkDir('c:/Users/Max Tan/Downloads/Packsecure OS/packsecure', (filePath) => {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(/\.from\(['"]([^'"]+)['"]\)/g);
        if (matches) {
            matches.forEach(m => {
                const tableName = m.match(/\.from\(['"]([^'"]+)['"]\)/)[1];
                tables.add(tableName);
            });
        }
    }
});

console.log("Found database tables referenced in code:", Array.from(tables));
