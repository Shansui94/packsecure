import fs from 'fs';
import path from 'path';

const searchDir = (dir, results = []) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                searchDir(fullPath, results);
            }
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const matches = content.match(/\.from\(['"]([^'"]+)['"]\)/g);
                if (matches) {
                    matches.forEach(m => {
                        const tableName = m.match(/\.from\(['"]([^'"]+)['"]\)/)[1];
                        results.push({ file: fullPath, table: tableName });
                    });
                }
            }
        }
    }
    return results;
};

const tables = searchDir('.');
const uniqueTables = [...new Set(tables.map(t => t.table))].sort();
console.log("Unique tables found in code:");
uniqueTables.forEach(t => console.log(`- ${t}`));
