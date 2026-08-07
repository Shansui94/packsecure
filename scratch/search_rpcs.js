import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '..', 'src');

function search(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            search(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('.rpc(')) {
                console.log(`Found .rpc( in: ${fullPath}`);
                const lines = content.split('\n');
                lines.forEach((line, idx) => {
                    if (line.includes('.rpc(')) {
                        console.log(`  Line ${idx + 1}: ${line.trim()}`);
                    }
                });
            }
        }
    }
}

try {
    search(srcDir);
} catch (e) {
    console.error(e);
}
