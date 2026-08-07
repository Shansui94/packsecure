import fs from 'fs';
import path from 'path';

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(fullPath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.mjs')) {
            results.push(fullPath);
        }
    });
    return results;
}

const files = walk('c:\\Users\\Max Tan\\Downloads\\Packsecure OS\\packsecure');
console.log(`Searching in ${files.length} files...`);

const rpcCalls = [];
files.forEach(file => {
    // skip node_modules, .git, etc
    if (file.includes('node_modules') || file.includes('.git') || file.includes('.vercel')) return;
    const content = fs.readFileSync(file, 'utf-8');
    let idx = 0;
    while (true) {
        idx = content.indexOf('.rpc(', idx);
        if (idx === -1) break;
        const line = content.substring(0, idx).split('\n').length;
        const context = content.substring(idx, idx + 100).replace(/\n/g, ' ');
        rpcCalls.push({ file, line, context });
        idx += 5;
    }
});

console.log(`Found ${rpcCalls.length} RPC calls:`);
rpcCalls.forEach(c => {
    console.log(`- ${c.file}:${c.line} -> ${c.context}`);
});
