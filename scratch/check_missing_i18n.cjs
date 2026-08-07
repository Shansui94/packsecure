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

const fileStats = {};

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const relName = path.relative('.', file);
    let count = 0;
    lines.forEach((line) => {
        if (/[\u4e00-\u9fa5]/.test(line)) {
            if (!line.includes('t(') && !line.includes('translateUI(') && !line.includes('Dict') && !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.includes('import') && !line.includes('console.')) {
                count++;
            }
        }
    });
    if (count > 0) {
        fileStats[relName] = count;
    }
}

const sorted = Object.entries(fileStats).sort((a, b) => b[1] - a[1]);
console.log('Unwrapped Chinese text count by file:');
sorted.forEach(([file, count]) => {
    console.log(`${count.toString().padStart(4, ' ')} lines : ${file}`);
});
