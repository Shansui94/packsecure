const { Project, SyntaxKind } = require('ts-morph');
const literalToNewKey = require('./literalToNewKey.json');

const project = new Project();
project.addSourceFilesAtPaths('src/**/*.{ts,tsx}');

let changedFiles = 0;

project.getSourceFiles().forEach(sourceFile => {
    let modified = false;

    // We will find all StringLiterals inside PropertyAssignments and if they match a known literal, we replace them
    // ONLY for specific variables like ALL_PAGES, CATEGORIES to be safe.
    sourceFile.getVariableDeclarations().forEach(v => {
        const name = v.getName();
        if (name === 'ALL_PAGES' || name === 'CATEGORIES' || name === 'visibleTabs') {
            v.forEachDescendant(node => {
                if (node.getKind() === SyntaxKind.PropertyAssignment) {
                    const propName = node.getNameNode().getText();
                    if (propName === 'label' || propName === 'labelKey') {
                        const init = node.getInitializer();
                        if (init && (init.getKind() === SyntaxKind.StringLiteral || init.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral)) {
                            const val = init.getLiteralText ? init.getLiteralText() : init.getText().slice(1, -1);
                            if (literalToNewKey[val] && literalToNewKey[val] !== val) {
                                init.replaceWithText(`'${literalToNewKey[val]}'`);
                                modified = true;
                            }
                        }
                    }
                }
            });
        }
    });

    // Handle Layout.tsx NavItems where label="literal"
    if (sourceFile.getBaseName() === 'Layout.tsx') {
        sourceFile.forEachDescendant(node => {
            if (node.getKind() === SyntaxKind.JsxAttribute && node.getNameNode().getText() === 'label') {
                const init = node.getInitializer();
                if (init && init.getKind() === SyntaxKind.StringLiteral) {
                    const val = init.getLiteralText();
                    if (literalToNewKey[val] && literalToNewKey[val] !== val) {
                        init.replaceWithText(`'${literalToNewKey[val]}'`);
                        modified = true;
                    }
                }
            }
        });
    }

    if (modified) {
        sourceFile.saveSync();
        console.log(`Updated data structures in ${sourceFile.getFilePath()}`);
        changedFiles++;
    }
});

console.log(`Done. Updated ${changedFiles} files.`);
