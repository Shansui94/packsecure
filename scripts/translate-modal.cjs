const fs = require('fs');
let code = fs.readFileSync('src/components/MachineInspectionModal.tsx', 'utf8');

// The English texts that were skipped by CHINESE_REGEX
const englishTexts = [
    ['Select screw channel to configure recipe & inspection', '选择螺杆通道配置混料配方及巡检'],
    ['Select Screw Channel', '选择螺杆通道'],
    ['Raw Materials & Mix', '原物料与 Mix料'],
    ['Position Adjustment', '机器调整'],
    ['Temperature Photos', '温度照片'],
    ['Machine Logs', '机器日志'],
    ['Machine Logs (0)', '机器日志 (0)']
];

// Add translations to i18n dictionaries
let i18n = fs.readFileSync('src/utils/i18n.ts', 'utf8');
englishTexts.forEach(([en, zh]) => {
    // Check if it's already in zhCNDict
    if (!i18n.includes("'" + en + "':")) {
        i18n = i18n.replace(/const zhCNDict: Record<string, string> = \{/, "const zhCNDict: Record<string, string> = {\n    '" + en + "': '" + zh + "',");
    }
});
fs.writeFileSync('src/utils/i18n.ts', i18n);

// Add Burmese translations to myDict
const burmeseDict = {
    'Select screw channel to configure recipe & inspection': 'စာရွက်စာတမ်းနှင့် စစ်ဆေးမှုကို သတ်မှတ်ရန် ဝက်အူလိုင်းကို ရွေးချယ်ပါ',
    'Select Screw Channel': 'ဝက်အူလိုင်းကို ရွေးချယ်ပါ',
    'Raw Materials & Mix': 'ကုန်ကြမ်းနှင့် အမွှေးအကြိုင်',
    'Position Adjustment': 'အနေအထား ပြင်ဆင်မှု',
    'Temperature Photos': 'အပူချိန် ဓာတ်ပုံများ',
    'Machine Logs': 'စက်မှတ်တမ်းများ',
    'Machine Logs (0)': 'စက်မှတ်တမ်းများ (0)',
    'Multi-Screw Recipe & Mix': 'ဝက်အူမျိုးစုံ ရောစပ်နည်း',
    '螺杆 A (Screw A)': 'ဝက်အူ A',
    '外层/主螺杆': 'အပြင်လွှာ/အဓိကဝက်အူ',
    '螺杆 B (Screw B)': 'ဝက်အူ B',
    '中层/辅螺杆': 'အလယ်လွှာ/အရန်ဝက်အူ',
    '螺杆 C (Screw C)': 'ဝက်အူ C',
    '内层 (2m大机器)': 'အတွင်းလွှာ (2m စက်ကြီး)',
    'HDPE 聚乙烯料': 'HDPE ပလတ်စတစ်',
    '包': 'အိတ်',
    '更改/增加物料': 'ကုန်ကြမ်း ပြောင်းလဲရန်/ထည့်ရန်',
    '单位 (1包=25kg)': 'ယူနစ် (၁ အိတ် = ၂၅ ကီလိုဂရမ်)',
    '包 (25kg)': 'အိတ် (၂၅ ကီလိုဂရမ်)',
    '此螺杆配方列表为空，点击 [➕ 更改/增加物料] 添加': 'ဤဝက်အူအတွက် စာရွက်စာတမ်းမရှိပါ။ [➕ ကုန်ကြမ်း ထည့်ရန်] ကိုနှိပ်ပါ။',
    '添加图片': 'ဓာတ်ပုံထည့်ပါ'
};

let i18nMy = fs.readFileSync('src/utils/i18n.ts', 'utf8');
for (const [en, my] of Object.entries(burmeseDict)) {
    if (!i18nMy.includes("'" + en + "':")) {
        i18nMy = i18nMy.replace(/const myDict: Record<string, string> = \{/, "const myDict: Record<string, string> = {\n    '" + en + "': '" + my + "',");
    }
}
fs.writeFileSync('src/utils/i18n.ts', i18nMy);


// Replace in MachineInspectionModal.tsx
englishTexts.forEach(([en, zh]) => {
    // If it's used inside JSX as text like >Select Screw Channel<
    code = code.split('>' + en + '<').join('>{t(\'' + en + '\')}<');
    code = code.split('> ' + en + ' <').join('> {t(\'' + en + '\')} <'); 
    code = code.split(' ' + en + ' ').join(' {t(\'' + en + '\')} '); // like > Raw Materials & Mix <
    // If it's used as string
    code = code.split("'" + en + "'").join("t('" + en + "')");
});

// Also manually replace the missed Chinese strings!
code = code.replace(/'螺杆 A \(Screw A\)'/g, "t('螺杆 A (Screw A)')");
code = code.replace(/'外层\/主螺杆'/g, "t('外层/主螺杆')");
code = code.replace(/'螺杆 B \(Screw B\)'/g, "t('螺杆 B (Screw B)')");
code = code.replace(/'中层\/辅螺杆'/g, "t('中层/辅螺杆')");
code = code.replace(/'螺杆 C \(Screw C\)'/g, "t('螺杆 C (Screw C)')");
code = code.replace(/'内层 \(2m大机器\)'/g, "t('内层 (2m大机器)')");
code = code.replace(/'HDPE 聚乙烯料'/g, "t('HDPE 聚乙烯料')");
code = code.replace(/'包'/g, "t('包')");
code = code.replace(/<PlusCircle size=\{14\} \/> ➕ 更改\/增加物料/g, "<PlusCircle size={14} /> ➕ {t('更改/增加物料')}");
code = code.replace(/单位 \(1包=25kg\)/g, "{t('单位 (1包=25kg)')}");
code = code.replace(/包 \(25kg\)/g, "{t('包 (25kg)')}");
code = code.replace(/此螺杆配方列表为空，点击 \[➕ 更改\/增加物料\] 添加/g, "{t('此螺杆配方列表为空，点击 [➕ 更改/增加物料] 添加')}");
code = code.replace(/📷 添加图片/g, "📷 {t('添加图片')}");
code = code.replace(/'kg' : '包'/g, "'kg' : t('包')");

// Also one last thing, Machine Logs (0) is dynamic if it's not exactly (0)
code = code.replace(/Machine Logs \(\{machineLogs\.length\}\)/g, "{t('Machine Logs')} ({machineLogs.length})");

fs.writeFileSync('src/components/MachineInspectionModal.tsx', code);
console.log('Fixed missed translations!');
