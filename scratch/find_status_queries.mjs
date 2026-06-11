import fs from 'fs';
import path from 'path';

function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (file === 'node_modules' || file === '.git' || file === '.firebase' || file === 'dist' || file === '.vercel') continue;
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            scanDir(fullPath);
        } else if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.ts') || file.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes("'status'") || content.includes('"status"') || content.includes('status ===') || content.includes('status !==')) {
                const lines = content.split('\n');
                lines.forEach((line, idx) => {
                    if (line.includes("'Active'") || line.includes('"Active"') || line.includes("'active'") || line.includes('"active"')) {
                        console.log(`${fullPath}:${idx + 1}: ${line.trim()}`);
                    }
                });
            }
        }
    }
}

console.log("Scanning src directory for status queries...");
scanDir('./src');
