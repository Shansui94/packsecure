const fs = require('fs');

const dicts = require('./extracted-dicts.json');

// We will use English words for slugs
const slugify = (text) => {
    return text.toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 40);
};

// We will build a unified mapping from Literal Key -> New Key
const literalToNewKey = {};
// We will build the new locales structure
const locales = {
    'zh-CN': {},
    'en': {},
    'ms': {},
    'zh-TW': {},
    'bn': {},
    'hi': {},
    'my': {}
};

// Map old dictionary names to locale keys
const dictToLocale = {
    'zhCNDict': 'zh-CN',
    'enDict': 'en',
    'msDict': 'ms',
    'zhTWDict': 'zh-TW',
    'bnDict': 'bn',
    'hiDict': 'hi',
    'myDict': 'my'
};

let counter = 1;

for (const [dictName, translations] of Object.entries(dicts)) {
    const locale = dictToLocale[dictName];
    if (!locale) continue;

    for (const [literalKey, translation] of Object.entries(translations)) {
        let newKey = literalToNewKey[literalKey];
        if (!newKey) {
            // Try to make a slug from the literal key if it contains english, else from the en translation if available
            let baseSlug = slugify(literalKey);
            if (!baseSlug && dicts['enDict'] && dicts['enDict'][literalKey]) {
                baseSlug = slugify(dicts['enDict'][literalKey]);
            }
            if (!baseSlug) {
                baseSlug = `term_${counter++}`;
            }
            
            // Ensure uniqueness
            newKey = baseSlug;
            let suffix = 1;
            while (Object.values(literalToNewKey).includes(newKey) && 
                   Object.keys(literalToNewKey).find(k => literalToNewKey[k] === newKey) !== literalKey) {
                newKey = `${baseSlug}_${suffix++}`;
            }
            literalToNewKey[literalKey] = newKey;
        }

        locales[locale][newKey] = translation;
    }
}

// Ensure all locales have the keys. If a key is missing, fallback to English or the Literal Key itself
const allKeys = new Set(Object.values(literalToNewKey));
for (const key of allKeys) {
    for (const locale of Object.keys(locales)) {
        if (!locales[locale][key]) {
            // Find the original literal key
            const literalKey = Object.keys(literalToNewKey).find(k => literalToNewKey[k] === key);
            
            if (locale === 'en') {
                 locales['en'][key] = dicts['enDict'][literalKey] || literalKey;
            } else if (locale === 'zh-CN') {
                 locales['zh-CN'][key] = dicts['zhCNDict'][literalKey] || literalKey;
            } else {
                 locales[locale][key] = dicts[`${locale.replace('-', '')}Dict`]?.[literalKey] || locales['en'][key] || literalKey;
            }
        }
    }
}

if (!fs.existsSync('src/locales')) {
    fs.mkdirSync('src/locales');
}

for (const [locale, translations] of Object.entries(locales)) {
    fs.writeFileSync(`src/locales/${locale}.json`, JSON.stringify(translations, null, 2));
}
fs.writeFileSync('scripts/literalToNewKey.json', JSON.stringify(literalToNewKey, null, 2));

console.log('Locales generated successfully in src/locales/');
