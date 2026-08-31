const { Project, SyntaxKind } = require('ts-morph');
const project = new Project();
project.addSourceFilesAtPaths(['src/pages/ProductionControl.tsx']);
const sf = project.getSourceFiles()[0];
const text = sf.getText();
console.log('Includes 类型?', text.includes('类型'));
let found = false;
let parentChain = [];
sf.forEachDescendant(node => {
    if (node.getText() === '"类型"' || node.getText() === '类型') {
        console.log('Found node:', node.getKindName(), node.getText());
        found = true;
        let parent = node.getParent();
        while (parent) {
            parentChain.push(parent.getKindName());
            parent = parent.getParent();
        }
        console.log('Parent chain:', parentChain.slice(0, 10));
    }
});
console.log('Done, found=', found);
