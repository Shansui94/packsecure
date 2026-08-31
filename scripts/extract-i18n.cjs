const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

const project = new Project();
project.addSourceFileAtPath('src/utils/i18n.ts');
const sourceFile = project.getSourceFile('src/utils/i18n.ts');

const dicts = {};

const vars = sourceFile.getVariableDeclarations();
for (const v of vars) {
    const name = v.getName();
    if (name.endsWith('Dict')) {
        const init = v.getInitializer();
        if (init && init.getKind() === SyntaxKind.ObjectLiteralExpression) {
            const props = init.getProperties();
            const dict = {};
            for (const p of props) {
                if (p.getKind() === SyntaxKind.PropertyAssignment) {
                    const keyNode = p.getNameNode();
                    let key = keyNode.getText();
                    if (key.startsWith("'") || key.startsWith('"')) {
                        key = key.slice(1, -1);
                    }
                    const valNode = p.getInitializer();
                    if (valNode && (valNode.getKind() === SyntaxKind.StringLiteral || valNode.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral)) {
                        dict[key] = valNode.getLiteralText();
                    }
                }
            }
            dicts[name] = dict;
        }
    }
}

fs.writeFileSync('scripts/extracted-dicts.json', JSON.stringify(dicts, null, 2));
console.log('Extracted dictionaries to scripts/extracted-dicts.json');
