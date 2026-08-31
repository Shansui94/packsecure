const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    if (fs.statSync(file).isDirectory()) { 
      if (!file.includes('locales') && !file.includes('node_modules')) {
        results = results.concat(walk(file));
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}
const files = walk('src');
const chineseRegex = /[\u4e00-\u9fa5]+/;
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (chineseRegex.test(content) && !f.includes('ClaimsManagement.tsx') && !f.includes('i18n.ts') && !f.includes('AGENTS.md')) {
     const matches = content.match(/['"`][^'"`]*[\u4e00-\u9fa5]+[^'"`]*['"`]/g) || [];
     
     // Filter out pure comments - although regex above matches strings with quotes, 
     // sometimes people write quotes inside comments.
     const validMatches = matches.filter(m => {
        // Also ignore matches that are keys like `t('ui_text_...')`
        if (m.includes('ui_text_')) return false;
        return true;
     });
     
     if (validMatches.length > 0) {
        console.log(f);
        validMatches.forEach(m => console.log('  ' + m));
     }
  }
});
