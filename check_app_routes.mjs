import * as fs from 'fs';

const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');
// Print routes
lines.forEach((line, idx) => {
    if (line.includes('<Route') || line.includes('path=') || line.includes('component=')) {
        console.log(`App.tsx Line ${idx + 1}: ${line.trim()}`);
    }
});

const layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');
const layoutLines = layout.split('\n');
layoutLines.forEach((line, idx) => {
    if (line.toLowerCase().includes('cuti') || line.toLowerCase().includes('leave') || line.toLowerCase().includes('advance')) {
        console.log(`Layout.tsx Line ${idx + 1}: ${line.trim()}`);
    }
});
