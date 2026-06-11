import fs from 'fs';

function searchInFile(filePath) {
    console.log(`=== Searching in ${filePath} ===`);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        const lower = line.toLowerCase();
        if (lower.includes('prep') || lower.includes('trip')) {
            console.log(`${idx + 1}: ${line.trim()}`);
        }
    });
}

searchInFile('src/App.tsx');
searchInFile('src/components/Layout.tsx');
