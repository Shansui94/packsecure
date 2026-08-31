const fs = require('fs');
const path = require('path');

const targetStrings = [
    'Type', 'Size', 'Run',
    'Pack Color', 'Change', 'Note (Optional)',
    'Live Production Active',
    'Units Produced This Session',
    'Click to enter PIN & bind operator to run machine.',
    'Click to Enter PIN & Takeover to STOP',
    'Select Size', 'BACK', 'Rolls', 'Change',
    'Select Screw Channel'
];

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    targetStrings.forEach(str => {
        // Regex to match exact inner text of tags like <span>Type</span> or >Type<
        // But some are props like placeholder="Note (Optional)"
        
        // 1. match >Text<
        const tagRegex = new RegExp(`>\\s*${str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")}\\s*<`, 'g');
        content = content.replace(tagRegex, (match) => {
            changed = true;
            return `>{t('${str}')}<`;
        });

        // 2. match placeholder="Text"
        const propRegex = new RegExp(`placeholder="${str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")}"`, 'g');
        content = content.replace(propRegex, (match) => {
            changed = true;
            return `placeholder={t('${str}')}`;
        });
        
        // 3. Match uppercase versions like PACK COLOR -> t('Pack Color')
        const upStr = str.toUpperCase();
        if (upStr !== str) {
            const upTagRegex = new RegExp(`>\\s*${upStr.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")}\\s*<`, 'g');
            content = content.replace(upTagRegex, (match) => {
                changed = true;
                return `>{t('${upStr}')}<`;
            });
        }
    });

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Extracted in ${filePath}`);
    }
}

console.log("Starting English extraction...");
processFile(path.join(__dirname, '../src/pages/ProductionControl.tsx'));
processFile(path.join(__dirname, '../src/components/MachineInspectionModal.tsx'));
console.log("Extraction complete.");
