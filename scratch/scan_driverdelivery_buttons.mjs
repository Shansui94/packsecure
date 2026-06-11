import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR ALL BUTTONS IN DriverDelivery.tsx ===");
let inButton = false;
let buttonLines = [];
let buttonStartIdx = 0;

lines.forEach((line, idx) => {
    if (line.includes('<button')) {
        inButton = true;
        buttonLines = [line.trim()];
        buttonStartIdx = idx + 1;
    } else if (inButton) {
        buttonLines.push(line.trim());
        if (line.includes('</button>')) {
            inButton = false;
            const fullButtonText = buttonLines.join(' ');
            if (fullButtonText.includes('Tamat') || fullButtonText.includes('tamat') || fullButtonText.includes('Selesai') || fullButtonText.includes('selesai') || fullButtonText.includes('Finish') || fullButtonText.includes('finish') || fullButtonText.includes('Complete') || fullButtonText.includes('complete') || fullButtonText.includes('End') || fullButtonText.includes('end')) {
                console.log(`Lines ${buttonStartIdx}-${idx + 1}: ${fullButtonText}`);
            }
        }
    }
});
