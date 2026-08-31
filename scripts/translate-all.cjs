const fs = require('fs');
const https = require('https');
const path = require('path');

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

async function main() {
    console.log("Starting missing translations for all JSON files...");
    const localesDir = path.join(__dirname, '../src/locales');
    const enDict = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
    const allKeys = Object.keys(enDict);

    const locales = {
        'ms': 'ms',
        'my': 'my',
        'zh-TW': 'zh-TW',
        'hi': 'hi',
        'bn': 'bn',
        'zh-CN': 'zh-CN'
    };

    for (const [locale, langCode] of Object.entries(locales)) {
        console.log(`\nTranslating missing keys for ${locale}...`);
        const filePath = path.join(localesDir, `${locale}.json`);
        let dict = {};
        if (fs.existsSync(filePath)) {
            dict = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }

        let count = 0;
        for (const k of allKeys) {
            // If it's missing or if it's the exact same as English (and it's not a short code)
            if (!dict[k] || dict[k] === k) {
                // translate
                const translated = await translateText(k, langCode);
                dict[k] = translated;
                process.stdout.write(`.`);
                count++;
                await sleep(150); // prevent rate limiting
            }
        }
        
        fs.writeFileSync(filePath, JSON.stringify(dict, null, 2));
        console.log(`\nUpdated ${count} translations in ${filePath}`);
    }
    console.log("Translation complete!");
}

main();
