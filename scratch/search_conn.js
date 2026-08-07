const fs = require('fs');
const path = require('path');

const dir = 'scripts';
fs.readdirSync(dir).forEach(s => {
    const p = path.join(dir, s);
    if (fs.statSync(p).isFile()) {
        const c = fs.readFileSync(p, 'utf8');
        if (c.includes('postgresql:')) {
            console.log(s);
            const matches = c.match(/postgresql:\/\/[^\s'"`]+/g);
            if (matches) console.log(matches);
        }
    }
});
