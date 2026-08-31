const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

const project = new Project();
project.addSourceFilesAtPaths('src/**/*.tsx');

project.getSourceFiles().forEach(file => {
    let modified = false;
    const hooks = file.getDescendantsOfKind(SyntaxKind.VariableStatement).filter(v => v.getText().includes('useTranslation()'));
    
    hooks.forEach(hook => {
        const func = hook.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ||
                     hook.getFirstAncestorByKind(SyntaxKind.ArrowFunction) ||
                     hook.getFirstAncestorByKind(SyntaxKind.FunctionExpression);
                     
        if (func) {
            let name = '';
            if (func.getKind() === SyntaxKind.FunctionDeclaration) {
                name = func.getName() || '';
            } else {
                const varDecl = func.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
                if (varDecl) name = varDecl.getName();
            }
            
            // If name starts with lowercase and is not a custom hook (starts with 'use')
            // it is a helper function or event handler. We MUST NOT call hooks inside it!
            if (name && /^[a-z]/.test(name) && !name.startsWith('use')) {
                console.log(`Removing invalid hook from ${name} in ${file.getFilePath()}`);
                hook.remove();
                modified = true;
            }
        }
    });

    if (modified) {
        file.saveSync();
    }
});
console.log('Fixed invalid hook calls!');
