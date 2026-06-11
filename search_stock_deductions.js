import fs from 'fs';
import path from 'path';

const searchDir = (dir, pattern, results = []) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                searchDir(fullPath, pattern, results);
            }
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.sql')) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                if (pattern.test(content)) {
                    results.push(fullPath);
                }
            }
        }
    }
    return results;
};

// Search for files referencing 'Auto-deduct' or 'Order Delivered' or 'stock_ledger_v2'
const files = searchDir('.', /stock_ledger_v2|Auto-deduct/);
console.log("Matching files:");
files.forEach(f => console.log(`- ${f}`));
