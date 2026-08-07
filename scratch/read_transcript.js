import * as fs from 'fs';
import * as path from 'path';

const appDataDir = 'C:\\Users\\Max Tan\\.gemini\\antigravity';
const convId = '9c75d04b-b9fb-4db8-a90e-d45481912e84';
const transcriptPath = path.join(appDataDir, 'brain', convId, '.system_generated', 'logs', 'transcript.jsonl');

if (fs.existsSync(transcriptPath)) {
    const content = fs.readFileSync(transcriptPath, 'utf8');
    const lines = content.split('\n');
    console.log(`Total lines: ${lines.length}`);
    lines.forEach((line, index) => {
        if (line.includes('4点') || line.includes('4 PM') || line.includes('4pm') || line.includes('完成') || line.includes('yesterday') || line.includes('trip')) {
            console.log(`Line ${index + 1}: ${line.substring(0, 300)}...`);
        }
    });
} else {
    console.log("Transcript not found");
}
