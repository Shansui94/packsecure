const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');
const path = require('path');

let genericCounter = 1;

const CHINESE_REGEX = /[\u4e00-\u9fa5]+/;

// Generate a nice slug for English text or pinyin for Chinese
// Since we might not have pinyin library, we will just use a generic 'text_1', 'text_2' for pure chinese,
// but let's try to map them dynamically. Actually, just using generic keys for now is safest, e.g. 'ui_word_1'
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      if (!file.includes('locales')) {
        results = results.concat(walk(file));
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}
const filesToProcess = ['src/components/MachineInspectionModal.tsx'];
const project = new Project();
project.addSourceFilesAtPaths(filesToProcess);

// Load existing locales to update them
const enLocale = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));
const zhLocale = JSON.parse(fs.readFileSync('src/locales/zh-CN.json', 'utf8'));

let newTranslationsCount = 0;

function getOrCreateKey(chineseText) {
    // Check if it already exists in zhLocale
    for (const [k, v] of Object.entries(zhLocale)) {
        if (v === chineseText) return k;
    }
    const newKey = `ui_text_${Date.now()}_${genericCounter++}`;
    zhLocale[newKey] = chineseText;
    enLocale[newKey] = chineseText; // Fallback to chinese in en until manually translated
    newTranslationsCount++;
    return newKey;
}

project.getSourceFiles().forEach(sourceFile => {
    let modified = false;
    let needsImport = false;

    // We process bottom up to avoid breaking AST ranges
    const nodes = [];
    
    sourceFile.forEachDescendant(node => {
        if (node.getKind() === SyntaxKind.JsxText) {
            const text = node.getText();
            if (CHINESE_REGEX.test(text) && text.trim().length > 0) {
                nodes.push({ type: 'JsxText', node });
            }
        } else if (node.getKind() === SyntaxKind.StringLiteral || node.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) {
            const text = node.getLiteralText ? node.getLiteralText() : node.getText().slice(1, -1);
            if (CHINESE_REGEX.test(text)) {
                // Ensure it's not already in t('...')
                const parent = node.getParent();
                if (parent && parent.getKind() === SyntaxKind.CallExpression) {
                    const funcName = parent.getExpression().getText();
                    if (funcName === 't' || funcName === 'translateUI') return;
                }
                // Exclude import declarations
                if (node.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)) return;
                
                nodes.push({ type: 'StringLiteral', node, parentKind: parent ? parent.getKind() : null });
            }
        }
    });

    // Sort nodes in reverse order (bottom-up)
    nodes.sort((a, b) => b.node.getPos() - a.node.getPos());

    for (const { type, node, parentKind } of nodes) {
        if (type === 'JsxText') {
            const text = node.getLiteralText ? node.getLiteralText() : node.getText();
            const trimmed = text.trim();
            const key = getOrCreateKey(trimmed);
            
            // Replace the JSX text, preserving surrounding whitespace
            const beforeWhitespace = text.match(/^\s*/)[0];
            const afterWhitespace = text.match(/\s*$/)[0];
            node.replaceWithText(`${beforeWhitespace}{t('${key}')}${afterWhitespace}`);
            modified = true;
            needsImport = true;
        } else if (type === 'StringLiteral') {
            const text = node.getLiteralText ? node.getLiteralText() : node.getText().slice(1, -1);
            const key = getOrCreateKey(text);
            
            if (parentKind === SyntaxKind.JsxAttribute) {
                node.replaceWithText(`{t('${key}')}`);
                modified = true;
                needsImport = true;
            } else if (parentKind === SyntaxKind.JsxExpression || parentKind === SyntaxKind.BinaryExpression || parentKind === SyntaxKind.ConditionalExpression || parentKind === SyntaxKind.ReturnStatement || parentKind === SyntaxKind.PropertyAssignment || parentKind === SyntaxKind.ArrayLiteralExpression) {
                if (parentKind === SyntaxKind.PropertyAssignment) {
                    const parentNode = node.getParent();
                    if (parentNode && parentNode.getNameNode() === node) {
                        node.replaceWithText(`[t('${key}')]`);
                    } else {
                        node.replaceWithText(`t('${key}')`);
                    }
                } else {
                    node.replaceWithText(`t('${key}')`);
                }
                modified = true;
                needsImport = true;
            }
        }
    }

    if (needsImport) {
        // Add import { useTranslation } from 'react-i18next'; if missing
        if (!sourceFile.getImportDeclaration('react-i18next')) {
            sourceFile.addImportDeclaration({
                namedImports: ['useTranslation'],
                moduleSpecifier: 'react-i18next'
            });
        }
        
        // Inject const { t } = useTranslation(); into every component function body
        sourceFile.getFunctions().forEach(f => {
            if (f.getName() && f.getName()[0] === f.getName()[0].toUpperCase()) {
                const body = f.getBody();
                if (body && body.getKind() === SyntaxKind.Block && !body.getText().includes('useTranslation')) {
                    body.insertStatements(0, 'const { t } = useTranslation();');
                }
            }
        });
        
        sourceFile.getVariableDeclarations().forEach(v => {
            const init = v.getInitializer();
            if (init && (init.getKind() === SyntaxKind.ArrowFunction || init.getKind() === SyntaxKind.FunctionExpression)) {
                if (v.getName() && v.getName()[0] === v.getName()[0].toUpperCase()) {
                    const body = init.getBody();
                    if (body && body.getKind() === SyntaxKind.Block && !body.getText().includes('useTranslation')) {
                        body.insertStatements(0, 'const { t } = useTranslation();');
                    }
                }
            }
        });
    }

    if (modified) {
        sourceFile.saveSync();
        console.log(`Migrated ${sourceFile.getFilePath()}`);
    }
});

fs.writeFileSync('src/locales/en.json', JSON.stringify(enLocale, null, 2));
fs.writeFileSync('src/locales/zh-CN.json', JSON.stringify(zhLocale, null, 2));

// Sync other locales
const otherLocales = ['ms', 'zh-TW', 'bn', 'hi', 'my'];
otherLocales.forEach(l => {
    const p = `src/locales/${l}.json`;
    const dict = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const [k, v] of Object.entries(zhLocale)) {
        if (!dict[k]) dict[k] = enLocale[k];
    }
    fs.writeFileSync(p, JSON.stringify(dict, null, 2));
});

console.log(`Done. Added ${newTranslationsCount} new keys.`);
