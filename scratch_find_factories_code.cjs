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
        } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx'))) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes(query)) {
                // print file and line
                const lines = content.split('\n');
                lines.forEach((line, idx) => {
                    if (line.includes(query) && line.includes('{') && (line.includes('name') || line.includes('id'))) {
                        console.log(`Found in: ${fullPath} (Line ${idx + 1}): ${line.trim()}`);
                    }
                });
            }
        }
    }
}

console.log("Searching for factory lists or definitions...");
searchDir('c:/Users/Max Tan/Downloads/Packsecure OS/packsecure/src', 'Taiping');
searchDir('c:/Users/Max Tan/Downloads/Packsecure OS/packsecure/src', 'Nilai');
