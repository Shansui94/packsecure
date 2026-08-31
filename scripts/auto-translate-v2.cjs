const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');
const path = require('path');

let genericCounter = 1;
const CHINESE_REGEX = /[\u4e00-\u9fa5]+/;

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

const filesToProcess = walk('src');
const project = new Project();
project.addSourceFilesAtPaths(filesToProcess);

const enLocale = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));
const zhLocale = JSON.parse(fs.readFileSync('src/locales/zh-CN.json', 'utf8'));

let newTranslationsCount = 0;

function getOrCreateKey(text) {
    for (const [k, v] of Object.entries(zhLocale)) {
        if (v === text) return k;
    }
    const newKey = `ui_text_${Date.now()}_${genericCounter++}`;
    zhLocale[newKey] = text;
    enLocale[newKey] = text;
    newTranslationsCount++;
    return newKey;
}

project.getSourceFiles().forEach(sourceFile => {
    let modified = false;
    let needsImport = false;
    const nodes = [];

    // Helper to check if a node is inside a type declaration
    function isInsideType(node) {
        let parent = node.getParent();
        while (parent) {
            if (
                parent.getKind() === SyntaxKind.TypeAliasDeclaration ||
                parent.getKind() === SyntaxKind.InterfaceDeclaration ||
                parent.getKind() === SyntaxKind.PropertySignature ||
                parent.getKind() === SyntaxKind.TypeLiteral ||
                parent.getKind() === SyntaxKind.UnionType ||
                parent.getKind() === SyntaxKind.LiteralType ||
                parent.getKind() === SyntaxKind.TypeReference
            ) {
                return true;
            }
            parent = parent.getParent();
        }
        return false;
    }

    // Check if node is inside a top-level constant definition that is not a component
    // If it is, replacing with t() might cause hook errors. But since we are targeting left-over texts, let's just replace and fix later if needed, or skip top level constants.
    function isTopLevelNonComponent(node) {
        let parent = node.getParent();
        let insideFunction = false;
        while (parent) {
            if (parent.getKind() === SyntaxKind.FunctionDeclaration || parent.getKind() === SyntaxKind.ArrowFunction || parent.getKind() === SyntaxKind.FunctionExpression) {
                insideFunction = true;
                break;
            }
            parent = parent.getParent();
        }
        return !insideFunction;
    }

    sourceFile.forEachDescendant(node => {
        if (isInsideType(node)) return; // Skip types entirely

        // Exclude import declarations
        if (node.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)) return;

        // Skip if inside console.log
        const callExp = node.getFirstAncestorByKind(SyntaxKind.CallExpression);
        if (callExp) {
            const exp = callExp.getExpression().getText();
            if (exp.includes('console.')) return;
            if (exp === 't' || exp === 'translateUI') return; // already translated
        }

        if (node.getKind() === SyntaxKind.JsxText) {
            const text = node.getText();
            if (CHINESE_REGEX.test(text) && text.trim().length > 0) {
                nodes.push({ type: 'JsxText', node });
            }
        } else if (node.getKind() === SyntaxKind.StringLiteral || node.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) {
            const text = node.getLiteralText ? node.getLiteralText() : node.getText().slice(1, -1);
            if (CHINESE_REGEX.test(text)) {
                nodes.push({ type: 'StringLiteral', node, parentKind: node.getParent().getKind() });
            }
        } else if (node.getKind() === SyntaxKind.TemplateExpression) {
            const text = node.getText();
            if (CHINESE_REGEX.test(text)) {
                // E.g. `Hello ${name}` -> "Hello {{name}}"
                nodes.push({ type: 'TemplateExpression', node, parentKind: node.getParent().getKind() });
            }
        }
    });

    nodes.sort((a, b) => b.node.getPos() - a.node.getPos());

    for (const { type, node, parentKind } of nodes) {
        if (isTopLevelNonComponent(node)) {
            // For top level variables, we skip translating them automatically because t() cannot be called outside components.
            // These require manual refactoring into functions. 
            // I will skip them and print them so we can handle them manually later if needed.
            console.log(`Skipped top-level const in ${sourceFile.getBaseName()}: ${node.getText()}`);
            continue;
        }

        if (type === 'JsxText') {
            const text = node.getText();
            const trimmed = text.trim();
            const key = getOrCreateKey(trimmed);
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
            } else if (parentKind === SyntaxKind.PropertyAssignment) {
                const parentNode = node.getParent();
                if (parentNode && parentNode.getNameNode() === node) {
                    node.replaceWithText(`[t('${key}')]`);
                } else {
                    node.replaceWithText(`t('${key}')`);
                }
                modified = true;
                needsImport = true;
            } else {
                node.replaceWithText(`t('${key}')`);
                modified = true;
                needsImport = true;
            }
        } else if (type === 'TemplateExpression') {
            // Extract the template string and variables
            const head = node.getHead().getLiteralText();
            const spans = node.getTemplateSpans();
            
            let i18nString = head;
            const vars = [];
            
            spans.forEach((span, index) => {
                const exp = span.getExpression().getText();
                // Simple variable name generation for i18n interpolation
                const varName = `var${index}`;
                i18nString += `{{${varName}}}` + span.getLiteral().getLiteralText();
                vars.push(`${varName}: ${exp}`);
            });
            
            const key = getOrCreateKey(i18nString);
            const replacement = `t('${key}', { ${vars.join(', ')} })`;
            
            if (parentKind === SyntaxKind.JsxAttribute || parentKind === SyntaxKind.JsxExpression) {
                node.replaceWithText(parentKind === SyntaxKind.JsxAttribute ? `{${replacement}}` : replacement);
            } else {
                node.replaceWithText(replacement);
            }
            modified = true;
            needsImport = true;
        }
    }

    if (needsImport) {
        if (!sourceFile.getImportDeclaration('react-i18next')) {
            sourceFile.addImportDeclaration({
                namedImports: ['useTranslation'],
                moduleSpecifier: 'react-i18next'
            });
        }
        
        const insertT = (body) => {
            if (body && body.getKind() === SyntaxKind.Block && !body.getText().includes('useTranslation')) {
                body.insertStatements(0, 'const { t } = useTranslation();');
            }
        };

        sourceFile.getFunctions().forEach(f => {
            if (f.getName() && f.getName()[0] === f.getName()[0].toUpperCase()) {
                insertT(f.getBody());
            }
        });
        
        sourceFile.getVariableDeclarations().forEach(v => {
            const init = v.getInitializer();
            if (init && (init.getKind() === SyntaxKind.ArrowFunction || init.getKind() === SyntaxKind.FunctionExpression)) {
                if (v.getName() && v.getName()[0] === v.getName()[0].toUpperCase()) {
                    insertT(init.getBody());
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
