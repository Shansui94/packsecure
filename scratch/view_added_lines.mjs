import { execSync } from 'child_process';

try {
    const showOutput = execSync('git show da6f4906537f30baeb82a239f45255c79ce0bce9', { maxBuffer: 50 * 1024 * 1024 }).toString();
    const lines = showOutput.split('\n');
    
    console.log("Printing diff context around line 3641:");
    for (let i = 3620; i < 3750; i++) {
        if (i < lines.length) {
            console.log(`${i + 1}: ${lines[i]}`);
        }
    }
} catch (e) {
    console.error(e);
}
