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

async function run() {
    console.log(`Found ${keysToTranslate.length} keys to translate.`);
    let count = 0;
    
    const batch = keysToTranslate.slice(0, 50);

    for (const key of batch) {
        const text = zh[key];
        
        if (en[key] && !/[\u4e00-\u9fa5]/.test(en[key])) {
            continue;
        }

        try {
            const { default: translate } = await import('translate');
            translate.engine = 'google';
            
            const textEn = await translate(text, { from: 'zh', to: 'en' });
            en[key] = textEn;
            
            const textMs = await translate(text, { from: 'zh', to: 'ms' });
            ms[key] = textMs;

            count++;
            if (count % 10 === 0) console.log(`Translated ${count} items...`);
            await delay(100);
        } catch (e) {
            console.log(`Failed to translate key ${key}: ${e.message}`);
        }
    }

    fs.writeFileSync(enFile, JSON.stringify(en, null, 2));
    fs.writeFileSync(msFile, JSON.stringify(ms, null, 2));
    console.log(`Successfully translated and injected ${count} items!`);
}

run();
