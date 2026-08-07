import { execSync } from 'child_process';

try {
    const oldCode = execSync('git show da6f4906537f30baeb82a239f45255c79ce0bce9^:src/pages/ProductionControl.tsx', { maxBuffer: 10 * 1024 * 1024 }).toString();
    const lines = oldCode.split('\n');
    
    // Find lines referencing operator_attendance
    lines.forEach((line, idx) => {
        if (line.includes('operator_attendance')) {
            console.log(`Line ${idx + 1}: ${line.trim()}`);
            // Print context
            console.log("--- Context ---");
            for (let i = Math.max(0, idx - 10); i < Math.min(lines.length, idx + 15); i++) {
                console.log(`${i + 1}: ${lines[i]}`);
            }
            console.log("---------------\n");
        }
    });
} catch (e) {
    console.error(e);
}
