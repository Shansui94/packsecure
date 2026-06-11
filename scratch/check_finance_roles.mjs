import fs from 'fs';
import path from 'path';

const srcDir = 'src';

function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            scanDirectory(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (/salary|payroll|rate|claim|advance|finance|amount|base_rate/i.test(content)) {
                // Find lines matching these keywords or role checks
                const lines = content.split('\n');
                lines.forEach((line, idx) => {
                    if (/role|admin|manager|superadmin|hr|driver/i.test(line) && /salary|payroll|rate|claim|advance|finance|amount|base_rate/i.test(line)) {
                        console.log(`${fullPath}:${idx + 1}: ${line.trim()}`);
                    }
                });
            }
        }
    }
}

console.log("Scanning src for role-based financial/salary/rate/advance checks...");
scanDirectory(srcDir);
