const fs = require('fs');
const https = require('https');

async function translateText(text, targetLang) {
    if (!text || typeof text !== 'string') return text;
    // Special handling for keys that shouldn't be translated or are just symbols
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

async function main() {
    console.log("Starting dictionary translation...");
    const zhDict = JSON.parse(fs.readFileSync('src/locales/zh-CN.json', 'utf8'));
    const locales = {
        'en': 'en',
        'ms': 'ms',
        'my': 'my',
        'zh-TW': 'zh-TW',
        'hi': 'hi',
        'bn': 'bn'
    };

    const keysToTranslate = Object.keys(zhDict).filter(k => k.startsWith('ui_text_'));
    console.log(`Found ${keysToTranslate.length} keys to translate.`);

    for (const [locale, langCode] of Object.entries(locales)) {
        console.log(`\nTranslating to ${locale}...`);
        const filePath = `src/locales/${locale}.json`;
        let dict = {};
        if (fs.existsSync(filePath)) {
            dict = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }

        for (let i = 0; i < keysToTranslate.length; i++) {
            const k = keysToTranslate[i];
            const originalText = zhDict[k];
            
            // If the current dictionary has the EXACT SAME Chinese text as zh-CN (which means it's untranslated)
            // or if it doesn't exist
            if (!dict[k] || dict[k] === originalText) {
                // translate
                const translated = await translateText(originalText, langCode);
                dict[k] = translated;
                process.stdout.write(`.`);
                await sleep(150); // prevent rate limiting
            }
        }
        
        fs.writeFileSync(filePath, JSON.stringify(dict, null, 2));
        console.log(`\nUpdated ${filePath}`);
    }
    console.log("Translation complete!");
}

main();
