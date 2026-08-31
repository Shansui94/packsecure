const fs = require('fs');

const zh = require('../src/locales/zh-CN.json');
const enFile = 'src/locales/en.json';
const msFile = 'src/locales/ms.json';

const en = require('../' + enFile);
const ms = require('../' + msFile);

const keysToTranslate = Object.keys(zh).filter(k => k.startsWith('ui_text_'));

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Ensure unique execution flag so we don't clobber
fs.writeFileSync('scripts/translate-progress.txt', 'started');

async function run() {
    console.log(`Found ${keysToTranslate.length} keys to translate.`);
    let count = 0;
    const { default: translate } = await import('translate');
    translate.engine = 'google';

    for (const key of keysToTranslate) {
        const text = zh[key];
        
        // Skip if already translated properly (doesn't contain Chinese in EN, unless the text itself has no Chinese)
        if (en[key] && !/[\u4e00-\u9fa5]/.test(en[key])) {
            continue;
        }

        let retries = 3;
        while (retries > 0) {
            try {
                const textEn = await translate(text, { from: 'zh', to: 'en' });
                en[key] = textEn;
                
                const textMs = await translate(text, { from: 'zh', to: 'ms' });
                ms[key] = textMs;

                count++;
                if (count % 10 === 0) {
                    console.log(`Translated ${count} items...`);
                    // Save incrementally
                    fs.writeFileSync(enFile, JSON.stringify(en, null, 2));
                    fs.writeFileSync(msFile, JSON.stringify(ms, null, 2));
                }
                await delay(100);
                break;
            } catch (e) {
                console.log(`Failed to translate key ${key}: ${e.message}. Retrying...`);
                retries--;
                await delay(2000);
                if (retries === 0) {
                    // Just fallback to English generic or keep Chinese
                }
            }
        }
    }

    fs.writeFileSync(enFile, JSON.stringify(en, null, 2));
    fs.writeFileSync(msFile, JSON.stringify(ms, null, 2));
    fs.writeFileSync('scripts/translate-progress.txt', 'done');
    console.log(`Successfully translated and injected ${count} items!`);
}

run();
