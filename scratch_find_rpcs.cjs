const fs = require('fs');
const path = require('path');

function searchDir(dir, query) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                searchDir(fullPath, query);
            }
        } else if (stat.isFile() && file.endsWith('.sql')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes(query)) {
                console.log(`Found "${query}" in SQL: ${fullPath}`);
            }
        }
    }
}

console.log("Searching for table references in SQL files...");
searchDir('c:/Users/Max Tan/Downloads/Packsecure OS/packsecure', 'operator_attendance');
searchDir('c:/Users/Max Tan/Downloads/Packsecure OS/packsecure', 'production_logs_v2');
searchDir('c:/Users/Max Tan/Downloads/Packsecure OS/packsecure', 'machine_active_products');
