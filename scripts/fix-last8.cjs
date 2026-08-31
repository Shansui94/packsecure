const fs = require('fs');

const zh = JSON.parse(fs.readFileSync('src/locales/zh-CN.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));
const my = JSON.parse(fs.readFileSync('src/locales/my.json', 'utf8'));
const ms = JSON.parse(fs.readFileSync('src/locales/ms.json', 'utf8'));

const fixes = {
  'ui_text_1786157471058_6': '智能助手 JARVIS',
  'ui_text_1786157470986_1': '请输入消息或语音命令...',
  'ui_text_1786157473615_120': '外层 (Outer Layer)',
  'ui_text_1786157473571_118': '中层 (Middle Layer)',
  'ui_text_1786157473526_116': '内层 (Inner Layer)',
  'ui_text_1786157472749_99': '种原料)',
  'ui_text_1786157472561_93': '包 (25kg)',
  'ui_text_1786157472111_74': '成功'
};

for (const [key, val] of Object.entries(fixes)) {
   zh[key] = val;
   en[key] = val;
   my[key] = val;
   ms[key] = val;
}

fs.writeFileSync('src/locales/zh-CN.json', JSON.stringify(zh, null, 2));
fs.writeFileSync('src/locales/en.json', JSON.stringify(en, null, 2));
fs.writeFileSync('src/locales/my.json', JSON.stringify(my, null, 2));
fs.writeFileSync('src/locales/ms.json', JSON.stringify(ms, null, 2));

console.log('Fixed the last 8 keys!');
