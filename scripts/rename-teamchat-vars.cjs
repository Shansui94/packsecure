const { Project, SyntaxKind } = require('ts-morph');
const project = new Project({ tsConfigFilePath: 'tsconfig.json' });
const sourceFile = project.getSourceFile('src/pages/TeamChat.tsx');

const params = sourceFile.getDescendantsOfKind(SyntaxKind.Parameter);
for (const p of params) {
    if (p.getName() === 't') {
        const parent = p.getParent();
        if (parent.getKind() === SyntaxKind.ArrowFunction) {
            const grandParent = parent.getParent();
            if (grandParent) {
                const text = grandParent.getText();
                if (text.includes('filteredThreads.map') || text.includes('threads.map')) {
                    p.rename('threadItem');
                } else if (text.includes('tasks.map') || text.includes('canvas_tasks:')) {
                    p.rename('cTask');
                } else {
                    p.rename('item');
                }
            } else {
                p.rename('item');
            }
        }
    }
}
sourceFile.saveSync();
console.log('Renamed variables in TeamChat.tsx');
