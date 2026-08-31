const fs = require('fs');
let code = fs.readFileSync('src/pages/ProductionControl.tsx', 'utf8');

const target = `<p className="text-[10px] font-bold text-gray-200 truncate">{p.user_note || p.ai_description || t('Live pictures')}</p>`;

const replacement = `<p className="text-[10px] font-bold text-gray-200 truncate" title={p.user_note}>
    {(() => {
        let note = p.user_note || p.ai_description || t('Live pictures');
        if (typeof note === 'string' && (note.trim().startsWith('[') || note.trim().startsWith('{'))) {
            try {
                const parsed = JSON.parse(note);
                if (parsed['log type']) return \`[\${parsed['log type']}] \${parsed.sku || ''}\`;
                return t('Machine Log Data');
            } catch(e) {
                return note;
            }
        }
        return note;
    })()}
</p>`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('src/pages/ProductionControl.tsx', code, 'utf8');
    console.log('Successfully replaced json renderer.');
} else {
    console.log('Target string not found!');
}
