const fs = require('fs');

async function run() {
    const { default: translate } = await import('translate');
    translate.engine = 'google';

    const locales = [
        { file: 'en.json', code: 'en' },
        { file: 'ms.json', code: 'ms' },
        { file: 'my.json', code: 'my' },
        { file: 'bn.json', code: 'bn' },
        { file: 'hi.json', code: 'hi' },
        { file: 'zh-TW.json', code: 'zh-TW' }
    ];

    const dicts = {};
    locales.forEach(l => {
        dicts[l.code] = JSON.parse(fs.readFileSync('src/locales/' + l.file, 'utf8'));
    });

    const zh = JSON.parse(fs.readFileSync('src/locales/zh-CN.json', 'utf8'));
    const keysToTranslate = Object.keys(zh);

    let count = 0;
    
    // Process one language at a time to avoid overwhelming Google and hitting IP ban
    for (const locale of locales) {
        console.log(`Translating for ${locale.code}...`);
        const dict = dicts[locale.code];
        for (const key of keysToTranslate) {
            const text = zh[key];
            if (typeof text !== 'string') continue;
            if (locale.code !== 'zh-TW' && dict[key] && !/[\u4e00-\u9fa5]/.test(dict[key])) {
                continue; // Already translated
            }
            if (locale.code === 'zh-TW' && dict[key] && dict[key] !== text && !text.includes(dict[key])) {
                // For zh-TW, if it's different from zh-CN, assume translated. 
                // But honestly, let's just translate if they are exactly the same (meaning it was copied).
                if (dict[key] !== text) continue;
            }

            try {
                const translated = await translate(text, { from: 'zh', to: locale.code });
                dict[key] = translated;
                count++;
                
                if (count % 500 === 0) {
                    process.stdout.write('.');
                    fs.writeFileSync('src/locales/' + locale.file, JSON.stringify(dict, null, 2));
                }
                
                await new Promise(r => setTimeout(r, 100)); // 100ms delay to avoid rate limit
            } catch (e) {
                console.log('\nError translating', text, 'to', locale.code, e.message);
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        console.log(`\nFinished ${locale.code}. Saving...`);
        fs.writeFileSync('src/locales/' + locale.file, JSON.stringify(dict, null, 2));
    }
    console.log('All translations done!');
}

run();
