// 全局离线/原生多语言翻译工具 (支持 100% 离线、移动端 PWA、无需依赖 Google Translate 网络)

export type SupportedLanguage = 'zh-CN' | 'zh-TW' | 'en' | 'ms' | 'my' | 'hi' | 'bn';

export const LANGUAGES: { code: SupportedLanguage; label: string; flag: string }[] = [
    { code: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
    { code: 'zh-TW', label: '繁體中文', flag: '🇭🇰' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'ms', label: 'Bahasa Melayu', flag: '🇲🇾' },
    { code: 'my', label: 'မြန်မာ', flag: '🇲🇲' },
    { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
    { code: 'bn', label: 'বাংলা', flag: '🇧🇩' }
];

// 核心通用字典
const TRANSLATION_DICTIONARY: Record<SupportedLanguage, Record<string, string>> = {
    'zh-CN': {
        'SuperAdmin': '超级管理员',
        'Admin': '管理员',
        'Manager': '经理',
        'Operator': '操作员',
        'Driver': '司机',
        'HR': '考勤/HR',
        'Operations': '车间作业',
        'Inventory & BOM': '库存与物料',
        'Logistics': '物流配送',
        'Organization': '人事与系统',
        'Productivity': '日常办公',
        'Production Floor': '生产作业空间',
        'Production Workspace': '生产工作区',
        'Multi-Screw Recipe & Mix': '多螺杆配料与Mix料',
        'Machine Inspection': '机台巡检与配料快记',
        'Submit Mix Record': '记录提交 Mix料操作与照片',
        'Screw Channel': '螺杆通道',
        'Screw A': '螺杆 A (Screw A)',
        'Screw B': '螺杆 B (Screw B)',
        'Screw C': '螺杆 C (Screw C)',
        'Add Material': '➕ 更改/增加物料',
        'Machine Logs': '本机日志',
        'Position Adjustment': '位置调整',
        'Temperature Photo': '温度照片',
        'Bag': '包 (25kg)',
        'Operator Duty': '在岗操作员',
        'No Operator': '未绑定操作员',
        'Sign Out': '退出登录',
        'Language': '语言选择'
    },
    'zh-TW': {
        'SuperAdmin': '超級管理員',
        'Admin': '管理員',
        'Manager': '經理',
        'Operator': '操作員',
        'Driver': '司機',
        'HR': '考勤/HR',
        'Operations': '車間作業',
        'Inventory & BOM': '庫存與物料',
        'Logistics': '物流配送',
        'Organization': '人事與系統',
        'Productivity': '日常辦公',
        'Production Floor': '生產作業空間',
        'Production Workspace': '生產工作區',
        'Multi-Screw Recipe & Mix': '多螺杆配料與Mix料',
        'Machine Inspection': '機台巡檢與配料快記',
        'Submit Mix Record': '記錄提交 Mix料操作與照片',
        'Screw Channel': '螺桿通道',
        'Screw A': '螺桿 A (Screw A)',
        'Screw B': '螺桿 B (Screw B)',
        'Screw C': '螺桿 C (Screw C)',
        'Add Material': '➕ 更改/增加物料',
        'Machine Logs': '本機日誌',
        'Position Adjustment': '位置調整',
        'Temperature Photo': '溫度照片',
        'Bag': '包 (25kg)',
        'Operator Duty': '在崗操作員',
        'No Operator': '未綁定操作員',
        'Sign Out': '退出登錄',
        'Language': '語言選擇'
    },
    'en': {
        'SuperAdmin': 'Super Admin',
        'Admin': 'Admin',
        'Manager': 'Manager',
        'Operator': 'Operator',
        'Driver': 'Driver',
        'HR': 'HR / Attendance',
        'Operations': 'Operations',
        'Inventory & BOM': 'Inventory & BOM',
        'Logistics': 'Logistics',
        'Organization': 'Organization & HR',
        'Productivity': 'Productivity',
        'Production Floor': 'Production Floor',
        'Production Workspace': 'Production Workspace',
        'Multi-Screw Recipe & Mix': 'Multi-Screw Recipe & Mix',
        'Machine Inspection': 'Machine Inspection & Mix Log',
        'Submit Mix Record': 'Submit Mix Record & Photo',
        'Screw Channel': 'Screw Channel',
        'Screw A': 'Screw A (Main)',
        'Screw B': 'Screw B (Middle)',
        'Screw C': 'Screw C (Inner)',
        'Add Material': '➕ Add/Change Material',
        'Machine Logs': 'Machine Logs',
        'Position Adjustment': 'Machine Adjustment',
        'Temperature Photo': 'Temperature Photo',
        'Bag': 'Bag (25kg)',
        'Operator Duty': 'Active Operator',
        'No Operator': 'No Active Operator',
        'Sign Out': 'Sign Out',
        'Language': 'Language'
    },
    'ms': {
        'SuperAdmin': 'Pentadbir Utama',
        'Admin': 'Pentadbir',
        'Manager': 'Pengurus',
        'Operator': 'Operator Kilang',
        'Driver': 'Pemandu',
        'HR': 'HR / Kehadiran',
        'Operations': 'Operasi Pengeluaran',
        'Inventory & BOM': 'Inventori & Stok',
        'Logistics': 'Logistik & Penghantaran',
        'Organization': 'Organisasi & HR',
        'Productivity': 'Produktiviti',
        'Production Floor': 'Lantai Pengeluaran',
        'Production Workspace': 'Ruang Kerja Pengeluaran',
        'Multi-Screw Recipe & Mix': 'Resipi Skru & Campuran Bahan',
        'Machine Inspection': 'Pemeriksaan Mesin & Campuran',
        'Submit Mix Record': 'Hantar Rekod Campuran & Foto',
        'Screw Channel': 'Saluran Skru',
        'Screw A': 'Skru A (Utama)',
        'Screw B': 'Skru B (Tengah)',
        'Screw C': 'Skru C (Dalam)',
        'Add Material': '➕ Tambah Bahan',
        'Machine Logs': 'Log Mesin',
        'Position Adjustment': 'Pelarasan Mesin',
        'Temperature Photo': 'Foto Suhu',
        'Bag': 'Beg (25kg)',
        'Operator Duty': 'Operator Bertugas',
        'No Operator': 'Tiada Operator',
        'Sign Out': 'Log Keluar',
        'Language': 'Pilih Bahasa'
    },
    'my': {
        'SuperAdmin': 'မန်နေဂျာချုပ်',
        'Admin': 'အက်ဒမင်',
        'Manager': 'မန်နေဂျာ',
        'Operator': 'စက်မောင်းသူ',
        'Driver': 'ယာဉ်မောင်း',
        'HR': 'ဝန်ထမ်းရေးရာ',
        'Operations': 'လုပ်ငန်းစဉ်များ',
        'Inventory & BOM': 'ကုန်ပစ္စည်းစာရင်း',
        'Logistics': 'ပို့ဆောင်ရေး',
        'Production Floor': 'ထုတ်လုပ်မှုဧရိယာ',
        'Multi-Screw Recipe & Mix': 'စက်ကုန်ကြမ်းစပ်နည်း',
        'Sign Out': 'ထွက်ရန်'
    },
    'hi': {
        'SuperAdmin': 'सुपर एडमिन',
        'Admin': 'एडमिन',
        'Manager': 'मैनेजर',
        'Operator': 'ऑपरेटर',
        'Driver': 'ड्राइवर',
        'HR': 'एचआर',
        'Operations': 'ऑपरेशन्स',
        'Multi-Screw Recipe & Mix': 'मशीन सामग्री मिश्रण',
        'Sign Out': 'साइन आउट'
    },
    'bn': {
        'SuperAdmin': 'সুপার অ্যাডমিন',
        'Admin': 'অ্যাডমিন',
        'Manager': 'ম্যানেজার',
        'Operator': 'অপারেটর',
        'Driver': 'ড্রাইভার',
        'HR': 'এইচআর',
        'Operations': 'অপারেশনস',
        'Multi-Screw Recipe & Mix': 'মেশিন উপাদান মিশ্রণ',
        'Sign Out': 'সাইন আউট'
    }
};

// 全局 获取当前语言
export const getCurrentLanguage = (): SupportedLanguage => {
    return (localStorage.getItem('packsecure_lang') as SupportedLanguage) || 'zh-CN';
};

// 全局 动态翻译函数
export const t = (text: string): string => {
    const lang = getCurrentLanguage();
    const dict = TRANSLATION_DICTIONARY[lang];
    if (dict && dict[text]) {
        return dict[text];
    }
    return text;
};

// 全局 切换语言函数 (写入 localStorage 并更新 DOM)
export const changeLanguage = (langCode: SupportedLanguage) => {
    localStorage.setItem('packsecure_lang', langCode);
    document.documentElement.lang = langCode;

    // 触发页面事件让所有组件感知
    window.dispatchEvent(new CustomEvent('packsecure:lang-change', { detail: langCode }));
    
    // 设置 Google Translate 全局 Cookie
    document.cookie = `googtrans=/zh-CN/${langCode}; path=/;`;
    document.cookie = `googtrans=/auto/${langCode}; path=/;`;
    document.cookie = `googtrans=/zh-CN/${langCode}; path=/; domain=` + window.location.hostname;
    document.cookie = `googtrans=/auto/${langCode}; path=/; domain=` + window.location.hostname;

    // 即时刷新页面生效
    setTimeout(() => {
        window.location.reload();
    }, 100);
};
