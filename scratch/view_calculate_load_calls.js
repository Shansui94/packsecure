import fs from 'fs';

function printLinesAround(filePath, query, contextLines = 20) {
    console.log(`\n=== File: ${filePath} ===`);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        if (line.includes(query)) {
            const start = Math.max(0, index - contextLines);
            const end = Math.min(lines.length - 1, index + contextLines);
            console.log(`--- Match at line ${index + 1} ---`);
            for (let i = start; i <= end; i++) {
                console.log(`${i + 1}: ${lines[i]}`);
            }
        }
    });
}

printLinesAround('src/pages/DeliveryOrderManagement.tsx', 'calculateLoad');
