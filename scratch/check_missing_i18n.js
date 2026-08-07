const fs = require('fs');
const path = require('path');

function getAllFiles(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            getAllFiles(filePath, fileList);
        } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

const files = [...getAllFiles('./src/pages'), ...getAllFiles('./src/components')];
console.log(`Scanning ${files.length} files for unwrapped Chinese strings...`);

const unwrapped = [];

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        // Find Chinese characters
        if (/[\u4e00-\u9fa5]/.test(line)) {
            // Filter out comments, dict definitions, imports, console logs, or t() calls
            if (!line.includes('t(') && !line.includes('translateUI(') && !line.includes('Dict') && !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.includes('import') && !line.includes('console.')) {
                unwrapped.push({ file: path.basename(file), line: idx + 1, text: line.trim() });
            }
        }
    });
}

console.log(`Found ${unwrapped.length} lines with unwrapped Chinese text.`);
console.log('Top 40 examples:');
unwrapped.slice(0, 40).forEach(u => console.log(`[${u.file}:${u.line}] ${u.text}`));
