import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');
const tables = new Set();
lines.forEach(line => {
    const match = line.match(/\.from\(['"]([^'"]+)['"]\)/);
    if (match) {
        tables.add(match[1]);
    }
});
console.log("Tables accessed in DriverDelivery.tsx:", Array.from(tables));
