import { execSync } from 'child_process';

try {
    const oldCode = execSync('git show da6f4906537f30baeb82a239f45255c79ce0bce9^:src/pages/ProductionControl.tsx', { maxBuffer: 10 * 1024 * 1024 }).toString();
    const lines = oldCode.split('\n');
    
    console.log("Printing old version around line 3600:");
    const start = Math.max(0, 3600);
    const end = Math.min(lines.length, 3800);
    
    for (let i = start; i < end; i++) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
} catch (e) {
    console.error(e);
}
