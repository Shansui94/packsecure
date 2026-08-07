import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

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

const zhCNDict: Record<string, string> = {
    'SuperAdmin': '超级管理员',
    'Admin': '管理员',
    'Manager': '经理',
    'Logistics Coordinator': '物流协调员',
    'Driver': '司机',
    'HR / Attendance': '考勤/HR',
    'Operator': '操作员',
    'Guest': '访客',
    'Operations': '车间作业',
    'Inventory & BOM': '库存与物料',
    'Logistics': '物流配送',
    'Organization': '人事与系统',
    'Productivity': '日常办公',
    'Production Floor': '生产作业空间',
    'Live Stock': '实时库存',
    'Trip Management': '出车管理',
    'Daily Prep': '每日准备',
    'Product Library': '产品库',
    'Maintenance Control': '设备维保',
    'Factory Live OS': '车间看板',
    'Data Command': '数据管理',
    'Production Workspace': '生产工作区',
    'Machine Schedule': '排产计划',
    'Floor Plan': '车间布局图',
    'Inventory': '库存管理',
    'Stock Movement': '库存变动',
    'Stock Audit': '库存盘点',
    'Audit Report': '盘点报告',
    'Lorry Fleet': '货车车队',
    'Lorry Fleet Management': '货车车队管理',
    'Production Logs': '生产记录',
    'Reports': '报表中心',
    'Report History': '历史报表',
    'Leave Center': '考勤请假',
    'Staff Hub / HR Portal': '人事看板 / HR门户',
    'IoT Settings': '物联网设置',
    'Dev Log': '开发日志',
    'Activity Logs': '操作日志',
    'My Monthly Report': '我的月度报告',
    'SOP Center': 'SOP 中心',
    'Work Photos': '📸 工作照片',
    'Notes': '备忘录',
    'Tasks': '任务看板',
    'My Deliveries': '我的配送',
    'Delivery History': '出车历史',
    'Staff Hub': '员工看板',
    'Lorry Service': '车辆维修',
    'HR Portal': 'HR 门户',
    'Yield & AI Learning': '收率与 AI 学习',
    'Machine QR Labels': '机器 QR 标签',
    'Sign Out': '退出登录',
    'System Language': '系统语言',
    'Search plate or driver': '搜索车牌号或司机...',
    'Grid View': '卡片视图',
    'Table View': '表格视图',
    'Lorry Plate': '车牌号',
    'Primary Driver': '主司机',
    'Zone': '出车区域',
    'Status': '状态',
    'Max Volume': '最大体积',
    'Max Weight': '最大载重',
    'Actions': '操作',
    'Edit': '编辑',
    'Unassigned': '未分配',
    'Resolve Discrepancy': '处理此异常',
    'Resolve Alert': '确认解决',
    'Prev Page': '上一页',
    'Next Page': '下一页'
};

const zhTWDict: Record<string, string> = {
    ...zhCNDict,
    'SuperAdmin': '超級管理員',
    'Admin': '管理員',
    'Manager': '經理',
    'Driver': '司機',
    'Operator': '操作員',
    'Sign Out': '退出登錄',
    'Lorry Fleet Management': '貨車車隊管理',
    'Grid View': '卡片視圖',
    'Table View': '表格視圖'
};

const enDict: Record<string, string> = {
    '超级管理员': 'Super Admin',
    '管理员': 'Admin',
    '经理': 'Manager',
    '物流协调员': 'Logistics Coordinator',
    '司机': 'Driver',
    '考勤/HR': 'HR / Attendance',
    '操作员': 'Operator',
    '访客': 'Guest',
    '多螺杆配料与Mix料': 'Multi-Screw Recipe & Mix',
    '车间作业': 'Operations',
    '库存与物料': 'Inventory & BOM',
    '物流配送': 'Logistics',
    '人事与系统': 'Organization & HR',
    '日常办公': 'Productivity',
    '生产作业空间': 'Production Floor',
    '实时库存': 'Live Stock',
    '出车管理': 'Trip Management',
    '每日准备': 'Daily Prep',
    '产品库': 'Product Library',
    '设备维保': 'Maintenance Control',
    '车间看板': 'Factory Live OS',
    '数据管理': 'Data Command',
    '生产工作区': 'Production Workspace',
    '排产计划': 'Machine Schedule',
    '车间布局图': 'Floor Plan',
    '库存管理': 'Inventory',
    '库存变动': 'Stock Movement',
    '库存盘点': 'Stock Audit',
    '盘点报告': 'Audit Report',
    '货车车队': 'Lorry Fleet Management',
    '货车车队管理': 'Lorry Fleet Management',
    '生产记录': 'Production Logs',
    '报表中心': 'Reports',
    '历史报表': 'Report History',
    '考勤请假': 'Leave Center',
    '人事看板 / HR门户': 'Staff Hub / HR Portal',
    '物联网设置': 'IoT Settings',
    '开发日志': 'Dev Log',
    '操作日志': 'Activity Logs',
    '我的月度报告': 'My Monthly Report',
    'SOP 中心': 'SOP Center',
    '📸 工作照片': '📸 Work Photos',
    '备忘录': 'Notes',
    '任务看板': 'Tasks',
    '我的配送': 'My Deliveries',
    '出车历史': 'Delivery History',
    '员工看板': 'Staff Hub',
    '车辆维修': 'Lorry Service',
    'HR 门户': 'HR Portal',
    '收率与 AI 学习': 'Yield & AI Learning',
    '机器 QR 标签': 'Machine QR Labels',
    '退出登录': 'Sign Out',
    '系统语言': 'System Language',
    '车队列表': 'Lorry Fleet',
    '里程日志与预警': 'Odometer Logs & Alerts',
    '月度里程总结': 'Monthly ODO Summary',
    '导出日志': 'Export Sheet (.xlsx)',
    '添加新车': 'Add New Lorry',
    '搜索车牌号或司机': 'Search plate or driver...',
    '卡片': 'Grid',
    '表格': 'Table',
    '车牌号': 'Lorry Plate',
    '主司机': 'Driver',
    '出车区域': 'Zone',
    '状态': 'Status',
    '最大体积': 'Max Volume',
    '最大载重': 'Max Weight',
    '操作': 'Actions',
    '编辑': 'Edit',
    '未分配': 'Unassigned',
    '处理此异常': 'Resolve Alert',
    '确认解决': 'Resolve',
    '上一页': 'Prev',
    '下一页': 'Next'
};

const msDict: Record<string, string> = {
    '超级管理员': 'Pentadbir Utama',
    '管理员': 'Pentadbir',
    '经理': 'Pengurus',
    '物流协调员': 'Koor. Logistik',
    '司机': 'Pemandu',
    '考勤/HR': 'HR / Kehadiran',
    '操作员': 'Operator Kilang',
    '车间作业': 'Operasi Pengeluaran',
    '库存与物料': 'Inventori & Stok',
    '物流配送': 'Logistik & Penghantaran',
    '人事与系统': 'Organisasi & HR',
    '日常办公': 'Produktiviti',
    '实时库存': 'Stok Semasa',
    '出车管理': 'Pengurusan Trip',
    '每日准备': 'Persediaan Harian',
    '产品库': 'Perpustakaan Produk',
    '设备维保': 'Penyelenggaraan Mesin',
    '货车车队': 'Pengurusan Lori',
    '货车车队管理': 'Pengurusan Armada Lori',
    '退出登录': 'Log Keluar',
    '车队列表': 'Senarai Lori',
    '里程日志与预警': 'Log Odometer & Amaran',
    '月度里程总结': 'Ringkasan Odometer Bulanan',
    '导出日志': 'Eksport Log (.xlsx)',
    '添加新车': 'Tambah Lori Baru',
    '搜索车牌号或司机': 'Cari nombor pendaftaran / pemandu...',
    '卡片': 'Kad',
    '表格': 'Jadual',
    '车牌号': 'No. Pendaftaran',
    '主司机': 'Pemandu Utama',
    '出车区域': 'Zon',
    '状态': 'Status',
    '最大体积': 'Isipadu Maksimum (m³)',
    '最大载重': 'Berat Maksimum (kg)',
    '操作': 'Tindakan',
    '编辑': 'Edit',
    '未分配': 'Belum Diperuntukkan',
    '处理此异常': 'Selesaikan Amaran',
    '确认解决': 'Sahkan Penyelesaian',
    '上一页': 'Sebelumnya',
    '下一页': 'Seterusnya'
};

const myDict: Record<string, string> = {
    '超级管理员': 'မန်နေဂျာချုပ်',
    '管理员': 'အက်ဒမင်',
    '经理': 'မန်နေဂျာ',
    '操作员': 'စက်မောင်းသူ',
    '司机': 'ယာဉ်မောင်း',
    '考勤/HR': 'ဝန်ထမ်းရေးရာ',
    '车间作业': 'လုပ်ငန်းစဉ်များ',
    '库存与物料': 'ကုန်ပစ္စည်းစာရင်း',
    '物流配送': 'ပို့ဆောင်ရေး',
    '货车车队管理': 'ယာဉ်မောင်းစီမံခန့်ခွဲမှု',
    '退出登录': 'ထွက်ရန်'
};

const hiDict: Record<string, string> = {
    '超级管理员': 'सुपर एडमिन',
    '管理员': 'एडमिन',
    '经理': 'मैनेजर',
    '操作员': 'ऑपरेटर',
    '司机': 'ड्राइवर',
    '考勤/HR': 'एचआर',
    '车间作业': 'ऑपरेशन्स',
    '货车车队管理': 'ट्रक बेड़ा प्रबंधन',
    '退出登录': 'साइन आउट'
};

const bnDict: Record<string, string> = {
    '超级管理员': 'সুপার অ্যাডমিন',
    '管理员': 'অ্যাডমিন',
    '经理': 'ম্যানেজার',
    '操作员': 'অপারেটর',
    '司机': 'ড্রাইভার',
    '考勤/HR': 'এইচআর',
    '车间作业': 'অপারেশনস',
    '货车车队管理': 'ট্রাক বহর ব্যবস্থাপনা',
    '退出登录': 'সাইন আউট'
};

const resources = {
    'zh-CN': { translation: zhCNDict },
    'zh-TW': { translation: zhTWDict },
    'en': { translation: enDict },
    'ms': { translation: msDict },
    'my': { translation: myDict },
    'hi': { translation: hiDict },
    'bn': { translation: bnDict }
};

const savedLang = (localStorage.getItem('packsecure_lang') as SupportedLanguage) || 'zh-CN';

i18n.use(initReactI18next).init({
    resources,
    lng: savedLang,
    fallbackLng: 'zh-CN',
    interpolation: {
        escapeValue: false
    }
});

export const getCurrentLanguage = (): SupportedLanguage => {
    return (localStorage.getItem('packsecure_lang') as SupportedLanguage) || 'zh-CN';
};

export const t = (text: string): string => {
    if (!text) return '';
    return i18n.t(text, { defaultValue: text });
};

export const changeLanguage = (langCode: SupportedLanguage) => {
    localStorage.setItem('packsecure_lang', langCode);
    document.documentElement.lang = langCode;

    // 清除所有 googtrans cookie
    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + window.location.hostname;

    i18n.changeLanguage(langCode);

    // 触发页面事件让订阅组件平滑更新
    window.dispatchEvent(new CustomEvent('packsecure:lang-change', { detail: langCode }));
};

export default i18n;
