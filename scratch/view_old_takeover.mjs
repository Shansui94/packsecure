import { execSync } from 'child_process';

try {
    const oldCode = execSync('git show da6f4906537f30baeb82a239f45255c79ce0bce9^:src/pages/ProductionControl.tsx', { maxBuffer: 10 * 1024 * 1024 }).toString();
    const lines = oldCode.split('\n');
    
    console.log("Printing old version from line 1050 to 1122:");
    for (let i = 1050; i < 1122; i++) {
        if (i < lines.length) {
            console.log(`${i + 1}: ${lines[i]}`);
        }
    }
} catch (e) {
    console.error(e);
}
