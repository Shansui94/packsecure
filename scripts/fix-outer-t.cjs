const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

const project = new Project({
    tsConfigFilePath: 'tsconfig.json',
});

// Add all TS/TSX files
project.addSourceFilesAtPaths('src/**/*.{ts,tsx}');

let modifiedFiles = 0;

project.getSourceFiles().forEach(sourceFile => {
    let modified = false;
    let needsImport = false;

    // Find all CallExpressions where the expression is "t"
    const callExprs = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    
    // We process from bottom to top to avoid offset shifting issues when replacing text
    const tCalls = callExprs
        .filter(c => c.getExpression().getText() === 't')
        .sort((a, b) => b.getStart() - a.getStart());

    for (const call of tCalls) {
        // Check if 't' is defined in scope
        const symbol = project.getTypeChecker().getSymbolAtLocation(call.getExpression());
        const decls = symbol ? symbol.getDeclarations() : [];
        
        // If there are no declarations, it means 't' is unbound!
        if (!decls || decls.length === 0) {
            call.getExpression().replaceWithText('i18next.t');
            modified = true;
            needsImport = true;
        }
    }

    if (modified) {
        if (needsImport) {
            const hasI18nextImport = sourceFile.getImportDeclarations().some(imp => imp.getModuleSpecifierValue() === 'i18next');
            if (!hasI18nextImport) {
                sourceFile.addImportDeclaration({
                    defaultImport: 'i18next',
                    moduleSpecifier: 'i18next'
                });
            }
        }
        sourceFile.saveSync();
        console.log('Fixed unbound t in', sourceFile.getFilePath());
        modifiedFiles++;
    }
});

console.log('Done. Fixed files:', modifiedFiles);
