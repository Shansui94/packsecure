const fs = require('fs');
let code = fs.readFileSync('src/pages/ProductionControl.tsx', 'utf8');
code = code.replace(
`const CATEGORIES: Record<string, { label: string; emoji: string; color: string }> = {
    qc: { label: 'QC 质检', emoji: '🔍', color: 'bg-apple-blue/20 text-blue-300 border-apple-blue/30' },
    defect: { label: 'Defect 次品', emoji: '⚠️', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
    downtime: { label: '停机 Stop', emoji: '🛑', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
    startup: { label: '开机 Start', emoji: '🟢', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
    recipe: { label: '原料配方', emoji: '🧪', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    carton: { label: '成品纸箱', emoji: '📦', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    other: { label: '其他 Other', emoji: '📋', color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
};`,
`const getCategories = (t: any): Record<string, { label: string; emoji: string; color: string }> => ({
    qc: { label: t('ui_text_1786328881734_3') || 'QC 质检', emoji: '🔍', color: 'bg-apple-blue/20 text-blue-300 border-apple-blue/30' },
    defect: { label: t('ui_text_1786328881734_4') || 'Defect 次品', emoji: '⚠️', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
    downtime: { label: t('ui_text_1786328881734_5') || '停机 Stop', emoji: '🛑', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
    startup: { label: t('ui_text_1786328881734_6') || '开机 Start', emoji: '🟢', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
    recipe: { label: t('ui_text_1786328881734_7') || '原料配方', emoji: '🧪', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    carton: { label: t('ui_text_1786328881734_8') || '成品纸箱', emoji: '📦', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    other: { label: t('ui_text_1786328881734_9') || '其他 Other', emoji: '📋', color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
});`
);
code = code.replace(
'{Object.entries(CATEGORIES).map(([key, cat]) => (',
'{Object.entries(getCategories(t)).map(([key, cat]) => ('
);
fs.writeFileSync('src/pages/ProductionControl.tsx', code);
console.log('Fixed ProductionControl.tsx CATEGORIES');
