import { execSync } from 'child_process';

try {
    const showOutput = execSync('git show da6f4906537f30baeb82a239f45255c79ce0bce9', { maxBuffer: 50 * 1024 * 1024 }).toString();
    const lines = showOutput.split('\n');
    
    console.log("Searching commit show output for operator_attendance:");
    let matched = 0;
    lines.forEach((line, idx) => {
        if (line.includes('operator_attendance') && (line.startsWith('+') || line.startsWith('-'))) {
            console.log(`Line ${idx + 1}: ${line}`);
            matched++;
        }
    });
    console.log(`Total matched diff lines: ${matched}`);
} catch (e) {
    console.error(e);
}
