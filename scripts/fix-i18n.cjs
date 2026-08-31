const fs = require('fs');
let code = fs.readFileSync('src/utils/i18n.ts', 'utf8');

const target = `export const t = (text: string): string => {
    if (!text) return '';
    return i18n.t(text, { defaultValue: text });
};`;

const replacement = `export const t = (text: string, options?: Record<string, any>): string => {
    if (!text) return '';
    return i18n.t(text, { defaultValue: text, ...options });
};`;

code = code.replace(target, replacement);
fs.writeFileSync('src/utils/i18n.ts', code);
console.log('Fixed t signature');
