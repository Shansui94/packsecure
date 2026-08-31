const fs = require('fs');
const https = require('https');

async function translateText(text, targetLang) {
    if (!text || typeof text !== 'string') return text;
    if (text.match(/^[0-9\s\.\-\/\+]+$/)) return text;
    
    return new Promise((resolve, reject) => {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    let translated = '';
                    if (json[0]) {
                        json[0].forEach(item => {
                            if (item[0]) translated += item[0];
                        });
                    }
                    resolve(translated || text);
                } catch (e) {
                    resolve(text);
                }
            });
        }).on('error', (e) => resolve(text));
    });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Extract dictionaries from i18n.ts
const extractDict = (code, dictName) => {
    const regex = new RegExp(`const ${dictName}(?:\\s*:\\s*Record<string,\\s*string>)?\\s*=\\s*({[\\s\\S]*?});`, 'm');
    const match = code.match(regex);
    if (!match) return {};
    
    // Evaluate the matched object literal
    try {
        let objStr = match[1];
        // Remove spread operators like ...zhCNDict
        objStr = objStr.replace(/\.\.\.[a-zA-Z0-9]+,/g, '');
        // simple eval wrapper
        const obj = eval(`(${objStr})`);
        return obj;
    } catch (e) {
        console.error(`Failed to parse ${dictName}:`, e);
        return {};
    }
};

async function main() {
    console.log("Translating missing hardcoded keys...");
    const i18nCode = fs.readFileSync('src/utils/i18n.ts', 'utf8');
    
    const zhCNDict = extractDict(i18nCode, 'zhCNDict');
    const hardcodedDicts = {
        'en': extractDict(i18nCode, 'enDict'),
        'ms': extractDict(i18nCode, 'msDict'),
        'my': extractDict(i18nCode, 'myDict'),
        'zh-TW': extractDict(i18nCode, 'zhTWDict'),
        'hi': extractDict(i18nCode, 'hiDict'),
        'bn': extractDict(i18nCode, 'bnDict')
    };

    const locales = {
        'en': 'en',
        'ms': 'ms',
        'my': 'my',
        'zh-TW': 'zh-TW',
        'hi': 'hi',
        'bn': 'bn'
    };

    const keysToTranslate = Object.keys(zhCNDict);
    console.log(`Found ${keysToTranslate.length} base keys in zhCNDict.`);

    for (const [locale, langCode] of Object.entries(locales)) {
        console.log(`\nChecking locale ${locale}...`);
        const filePath = `src/locales/${locale}.json`;
        let jsonDict = {};
        if (fs.existsSync(filePath)) {
            jsonDict = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        
        const hardcoded = hardcodedDicts[locale] || {};
        let addedCount = 0;

        for (let i = 0; i < keysToTranslate.length; i++) {
            const k = keysToTranslate[i];
            const originalText = zhCNDict[k]; // The Chinese or Base text
            
            // If the key is missing in BOTH hardcoded and JSON
            if (!hardcoded[k] && !jsonDict[k]) {
                const translated = await translateText(originalText, langCode);
                jsonDict[k] = translated;
                addedCount++;
                process.stdout.write(`.`);
                await sleep(150);
            }
        }
        
        if (addedCount > 0) {
            fs.writeFileSync(filePath, JSON.stringify(jsonDict, null, 2));
            console.log(`\nAdded ${addedCount} new translations to ${filePath}`);
        } else {
            console.log(`\nNo new translations needed for ${locale}.`);
        }
    }
    console.log("Translation complete!");
}

main();
