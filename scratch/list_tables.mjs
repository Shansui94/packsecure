import fs from 'fs';

const content = fs.readFileSync('c:/Users/Max Tan/Downloads/Packsecure OS/packsecure/src/pages/ProductionControl.tsx', 'utf8');
const regex = /\.from\(['"]([^'"]+)['"]\)/g;
let match;
const tables = new Set();
while ((match = regex.exec(content)) !== null) {
    tables.add(match[1]);
}
console.log("Tables queried in ProductionControl.tsx:", Array.from(tables));
