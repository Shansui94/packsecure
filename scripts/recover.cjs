const fs = require('fs');
const execSync = require('child_process').execSync;

let diff;
try {
  diff = execSync('git diff -U0 src/').toString();
} catch(e) {
  diff = e.stdout.toString();
}

const lines = diff.split('\n');
let minusLines = [];
let plusLines = [];
let pairs = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith('@@ ')) {
     minusLines = [];
     plusLines = [];
  } else if (line.startsWith('-') && !line.startsWith('---')) {
     minusLines.push(line.substring(1));
  } else if (line.startsWith('+') && !line.startsWith('+++')) {
     plusLines.push(line.substring(1));
  }
  
  if (i + 1 === lines.length || lines[i+1].startsWith('@@ ') || lines[i+1].startsWith('diff ')) {
     if (minusLines.length === plusLines.length && minusLines.length > 0) {
        for (let j = 0; j < minusLines.length; j++) {
           const minus = minusLines[j];
           const plus = plusLines[j];
           const keyMatch = plus.match(/ui_text_\d+_\d+/);
           if (keyMatch) {
              const key = keyMatch[0];
              // Find chinese text in minus
              const chineseMatch = minus.match(/[\u4e00-\u9fa5]+[a-zA-Z0-9\s\u4e00-\u9fa5\-\/\(\)]*/);
              if (chineseMatch) {
                 pairs.push({ key, text: chineseMatch[0].trim() });
              }
           }
        }
     } else if (plusLines.length > 0) {
        const allMinus = minusLines.join(' ');
        const allPlus = plusLines.join(' ');
        const keys = [...allPlus.matchAll(/ui_text_\d+_\d+/g)].map(m => m[0]);
        const chinese = [...allMinus.matchAll(/[\u4e00-\u9fa5]+[a-zA-Z0-9\s\u4e00-\u9fa5\-\/\(\)]*/g)].map(m => m[0]);
        if (keys.length === 1 && chinese.length >= 1) {
             pairs.push({ key: keys[0], text: chinese[0].trim() });
        } else if (keys.length > 1 && keys.length === chinese.length) {
             for (let k = 0; k < keys.length; k++) {
                 pairs.push({ key: keys[k], text: chinese[k].trim() });
             }
        }
     }
  }
}

const zh = JSON.parse(fs.readFileSync('src/locales/zh-CN.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));
const my = JSON.parse(fs.readFileSync('src/locales/my.json', 'utf8'));
const ms = JSON.parse(fs.readFileSync('src/locales/ms.json', 'utf8'));

let added = 0;
pairs.forEach(p => {
   if (!zh[p.key]) {
      zh[p.key] = p.text;
      en[p.key] = p.text;
      my[p.key] = p.text;
      ms[p.key] = p.text;
      added++;
   }
});

fs.writeFileSync('src/locales/zh-CN.json', JSON.stringify(zh, null, 2));
fs.writeFileSync('src/locales/en.json', JSON.stringify(en, null, 2));
fs.writeFileSync('src/locales/my.json', JSON.stringify(my, null, 2));
fs.writeFileSync('src/locales/ms.json', JSON.stringify(ms, null, 2));

console.log('Added missing keys:', added);
