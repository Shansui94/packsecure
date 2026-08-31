const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

const literalToNewKey = require('./literalToNewKey.json');

const project = new Project();
project.addSourceFilesAtPaths('src/**/*.{ts,tsx}');

let changedFiles = 0;

project.getSourceFiles().forEach(sourceFile => {
    let modified = false;

    sourceFile.forEachDescendant(node => {
        if (node.getKind() === SyntaxKind.CallExpression) {
            const expression = node.getExpression();
            const funcName = expression.getText();

            if (funcName === 't' || funcName === 'translateUI') {
                const args = node.getArguments();
                if (args.length > 0) {
                    const firstArg = args[0];
                    if (firstArg.getKind() === SyntaxKind.StringLiteral || firstArg.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) {
                        const literalValue = firstArg.getLiteralText ? firstArg.getLiteralText() : firstArg.getText().slice(1, -1);
                        
                        if (literalToNewKey[literalValue]) {
                            const newKey = literalToNewKey[literalValue];
                            if (newKey !== literalValue) {
                                firstArg.replaceWithText(`'${newKey}'`);
                                modified = true;
                            }
                        }
                    }
                }
            }
        }
    });

    if (modified) {
        sourceFile.saveSync();
        console.log(`Updated ${sourceFile.getFilePath()}`);
        changedFiles++;
    }
});

console.log(`Done. Updated ${changedFiles} files.`);
