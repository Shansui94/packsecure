import { execSync } from 'child_process';

try {
    const diff = execSync('git diff da6f4906537f30baeb82a239f45255c79ce0bce9^ da6f4906537f30baeb82a239f45255c79ce0bce9 -- src/pages/ProductionControl.tsx').toString();
    const lines = diff.split('\n');
    
    console.log("Diff lines with operator_attendance:");
    lines.forEach((line, idx) => {
        if (line.includes('operator_attendance')) {
            console.log(`Line ${idx}: ${line}`);
            // Print 5 lines before and after
            for (let i = Math.max(0, idx - 5); i < Math.min(lines.length, idx + 6); i++) {
                console.log(`  [${i - idx}] ${lines[i]}`);
            }
            console.log('-----------------');
        }
    });
} catch (e) {
    console.error(e);
}
