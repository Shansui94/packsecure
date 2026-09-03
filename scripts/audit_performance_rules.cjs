const fs = require('fs');
const path = require('path');

function search(dir) {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
        const p = path.join(dir, item.name);
        if (item.isDirectory() && !item.name.includes('node_modules') && !item.name.includes('.git') && !item.name.includes('dist')) {
            search(p);
        } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.tsx') || item.name.endsWith('.md'))) {
            const txt = fs.readFileSync(p, 'utf8');
            const keywords = ['allowance', 'bonus', 'full_attendance', '全勤', 'commission', 'elaun', 'kehadiran', 'driver_deliveries', 'attendance'];
            const matched = keywords.filter(k => txt.toLowerCase().includes(k.toLowerCase()));
            if (matched.length > 0) {
                console.log(`File: ${p} -> Matched: ${matched.join(', ')}`);
            }
        }
    }
}

console.log('=== AUDITING EXISTING PERFORMANCE, ATTENDANCE & BONUS RULES ===');
search('src');
search('docs');
