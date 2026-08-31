const fs = require('fs');
const path = require('path');

// 1. Load en.json
const enPath = path.join(__dirname, '../src/locales/en.json');
let enDict = {};
if (fs.existsSync(enPath)) {
    enDict = JSON.parse(fs.readFileSync(enPath, 'utf8'));
}

const uiTextKeys = Object.keys(enDict).filter(k => k.startsWith('ui_text_'));
console.log(`Found ${uiTextKeys.length} ui_text_ keys in en.json`);

function safeStringLiteral(str) {
    const escaped = str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
    return `'${escaped}'`;
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    const regex = /t\s*\(\s*['"`](ui_text_\d+_\d+)['"`]\s*([,\)])/g;
    content = content.replace(regex, (match, key, suffix) => {
        const engText = enDict[key];
        if (engText) {
            changed = true;
            return `t(${safeStringLiteral(engText)}${suffix}`;
        }
        return match;
    });
    
    const regexI18n = /i18n\.t\s*\(\s*['"`](ui_text_\d+_\d+)['"`]\s*([,\)])/g;
    content = content.replace(regexI18n, (match, key, suffix) => {
        const engText = enDict[key];
        if (engText) {
            changed = true;
            return `i18n.t(${safeStringLiteral(engText)}${suffix}`;
        }
        return match;
    });

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walkDir(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            processFile(fullPath);
        }
    }
}

console.log("Starting refactoring...");
walkDir(path.join(__dirname, '../src'));
console.log("Refactoring complete.");
