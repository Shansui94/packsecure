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
        } else if (file.endsWith('.sql') || file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.json') || file.endsWith('.txt') || file.endsWith('.yml') || file.endsWith('.yaml') || file.endsWith('.env') || file.endsWith('.env.example') || file.endsWith('.env.production')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('postgresql://') || content.includes('postgres://') || content.includes('db.kdahubyhwndgyloaljak')) {
                console.log(`Found PG URL reference in: ${fullPath}`);
            }
        }
    }
}

console.log("Scanning workspace for PG URL references...");
scanDir('.');
