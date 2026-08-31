const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

const project = new Project();
project.addSourceFilesAtPaths('src/pages/**/*.tsx');
project.addSourceFilesAtPaths('src/components/**/*.tsx');

let modifiedAny = false;

project.getSourceFiles().forEach(file => {
    let modified = false;
    
    // Find all CallExpressions of `t`
    const callExpressions = file.getDescendantsOfKind(SyntaxKind.CallExpression);
    const componentsToInject = new Set();
    
    callExpressions.forEach(call => {
        if (call.getExpression().getText() === 't') {
            // Check if t is defined in scope
            // We'll just find the closest FunctionDeclaration, ArrowFunction, or FunctionExpression
            const func = call.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ||
                         call.getFirstAncestorByKind(SyntaxKind.ArrowFunction) ||
                         call.getFirstAncestorByKind(SyntaxKind.FunctionExpression);
                         
            if (func) {
                // Check if this function already has `const { t } = useTranslation();`
                const body = func.getBody();
                if (body && body.getKind() === SyntaxKind.Block) {
                    const hasT = body.getText().includes('useTranslation()');
                    if (!hasT) {
                        componentsToInject.add(func);
                    }
                }
            }
        }
    });
    
    componentsToInject.forEach(func => {
        const body = func.getBody();
        if (body && body.getKind() === SyntaxKind.Block) {
            body.insertStatements(0, 'const { t } = useTranslation();');
            modified = true;
            modifiedAny = true;
        }
    });

    if (modified) {
        // Ensure import is there
        const imports = file.getImportDeclarations();
        const hasImport = imports.some(i => i.getModuleSpecifierValue() === 'react-i18next');
        if (!hasImport) {
            file.addImportDeclaration({
                namedImports: ['useTranslation'],
                moduleSpecifier: 'react-i18next'
            });
        }
        file.saveSync();
        console.log(`Fixed missing t() definitions in ${file.getFilePath()}`);
    }
});

if (!modifiedAny) {
    console.log('No missing t() definitions found.');
}
