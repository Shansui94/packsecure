const fs = require('fs');
function walk(dir) {
  const fg = require('path');
  let res = [];
  fs.readdirSync(dir).forEach(f => {
    let p = fg.join(dir, f);
    if(fs.statSync(p).isDirectory()) res.push(...walk(p));
    else if(p.endsWith('.tsx') || p.endsWith('.ts')) res.push(p);
  });
  return res;
}
const files = walk('src');
for(let file of files) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes('i18next.t(')) {
    if (!text.includes("from 'i18next'") && !text.includes('from "i18next"')) {
      console.log('Missing import in:', file);
      // Auto fix it!
      const lines = text.split('\n');
      lines.unshift("import i18next from 'i18next';");
      fs.writeFileSync(file, lines.join('\n'));
      console.log('Fixed:', file);
    }
  }
}
