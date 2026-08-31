const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
const localesDir = path.join(srcDir, 'locales');
const i18nPath = path.join(srcDir, 'utils/i18n.ts');

const locales = ['en', 'ms', 'my', 'zh-TW', 'hi', 'bn', 'zh-CN'];

// Extract old hardcoded dicts from i18n.ts to ensure no translation is lost
function extractDict(code, dictName) {
    const regex = new RegExp(`const ${dictName}(?:\\s*:\\s*Record<string,\\s*string>)?\\s*=\\s*({[\\s\\S]*?});`, 'm');
    const match = code.match(regex);
    if (!match) return {};
    try {
        let objStr = match[1].replace(/\.\.\.[a-zA-Z0-9]+,/g, '');
        return eval(`(${objStr})`);
    } catch (e) { return {}; }
}

const i18nCode = fs.readFileSync(i18nPath, 'utf8');
const oldDicts = {
    'en': extractDict(i18nCode, 'enDict'),
    'zh-CN': extractDict(i18nCode, 'zhCNDict'),
    'zh-TW': extractDict(i18nCode, 'zhTWDict'),
    'ms': extractDict(i18nCode, 'msDict'),
    'my': extractDict(i18nCode, 'myDict'),
    'hi': extractDict(i18nCode, 'hiDict'),
    'bn': extractDict(i18nCode, 'bnDict')
};

// 1. Scan for all English keys used in codebase
const englishKeys = new Set();
function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            // Match t('...') and t("...") and t(`...`)
            const regex = /t\s*\(\s*['"`](.*?)['"`]\s*([,\)])/g;
            let match;
            while ((match = regex.exec(content)) !== null) {
                englishKeys.add(match[1]);
            }
            
            const regexI18n = /i18n\.t\s*\(\s*['"`](.*?)['"`]\s*([,\)])/g;
            while ((match = regexI18n.exec(content)) !== null) {
                englishKeys.add(match[1]);
            }
        }
    }
}
walkDir(srcDir);
console.log(`Found ${englishKeys.size} distinct English keys in source.`);

// 2. Load existing JSONs to preserve translations
// Note: existing JSON keys might be English now since we replaced ui_text_ with English in the TSX files!
// Wait! In the JSON files, the keys are STILL `ui_text_xxx` and `Chinese Strings`!
// We need to map `ui_text_xxx` back to English in the JSON files too!
// Fortunately, we can use `en.json` (which maps ui_text -> English) to resolve this.

let enJsonOld = {};
try { enJsonOld = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8')); } catch(e){}

// Build a translation map: { englishKey: { my: '...', ms: '...', ... } }
const translationMemory = {};

for (const lang of locales) {
    let jsonOld = {};
    try { jsonOld = JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8')); } catch(e){}
    
    // Combine JSON + Hardcoded
    const combinedOld = { ...oldDicts[lang], ...jsonOld };

    for (const [k, v] of Object.entries(combinedOld)) {
        // If the key is ui_text_xxx, its English text is enJsonOld[k]
        // If the key is Chinese, its English text is enJsonOld[k] OR enDict[k]
        
        let engKey = k; // Assume the key itself is the English key first
        
        if (k.startsWith('ui_text_') && enJsonOld[k]) {
            engKey = enJsonOld[k];
        } else if (oldDicts['en'][k]) {
            // e.g. k is '生产控制工作台', enDict has it mapped to 'Production Workspace'
            engKey = oldDicts['en'][k];
        } else if (enJsonOld[k] && enJsonOld[k] !== k) {
             engKey = enJsonOld[k];
        }

        if (!translationMemory[engKey]) translationMemory[engKey] = {};
        if (v && typeof v === 'string') {
            translationMemory[engKey][lang] = v;
        }
    }
}

// 3. Build new JSON files
for (const lang of locales) {
    const newJson = {};
    for (const engKey of englishKeys) {
        if (!engKey.trim()) continue; // Skip empty keys
        
        if (lang === 'en') {
            newJson[engKey] = engKey; // English maps to English
        } else {
            // Find best translation
            let translated = translationMemory[engKey] ? translationMemory[engKey][lang] : null;
            if (translated && translated !== engKey) {
                newJson[engKey] = translated;
            } else {
                // We'll leave it out or map to English, and our missing translation script will pick it up
                newJson[engKey] = engKey; 
            }
        }
    }
    fs.writeFileSync(path.join(localesDir, `${lang}.json`), JSON.stringify(newJson, null, 2));
    console.log(`Wrote ${lang}.json with ${Object.keys(newJson).length} keys.`);
}

console.log("JSON rebuild complete.");
