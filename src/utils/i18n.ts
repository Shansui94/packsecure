import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Dynamic JSON imports
import zhCNJson from '../locales/zh-CN.json';
import enJson from '../locales/en.json';
import msJson from '../locales/ms.json';
import myJson from '../locales/my.json';
import zhTWJson from '../locales/zh-TW.json';
import hiJson from '../locales/hi.json';
import bnJson from '../locales/bn.json';

export type SupportedLanguage = 'zh-CN' | 'en' | 'ms' | 'my' | 'zh-TW' | 'hi' | 'bn';

export const LANGUAGES: { code: SupportedLanguage; label: string; flag: string }[] = [
    { code: 'zh-CN', label: '中文 (简体)', flag: '🇨🇳' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'zh-TW', label: '中文 (繁體)', flag: '🇹🇼' },
    { code: 'ms', label: 'Bahasa Melayu', flag: '🇲🇾' },
    { code: 'my', label: 'မြန်မာဘာသာ', flag: '🇲🇲' },
    { code: 'hi', label: 'हिंदी', flag: '🇮🇳' },
    { code: 'bn', label: 'বাংলা', flag: '🇧🇩' }
];

/**
 * 高频核心术语表（角色、导航、操作、状态双向无死角映射）
 * 无论前端代码传入英文 Key 还是中文 Key，都能在任何语言下准确还原，绝不中英大混杂。
 */
export const CORE_TERMS: {
    en: string;
    'zh-CN': string;
    'zh-TW': string;
    ms: string;
    my: string;
    hi: string;
    bn: string;
}[] = [
    // 角色 Roles
    { en: 'Super Admin', 'zh-CN': '超级管理员', 'zh-TW': '超級管理員', ms: 'Pentadbir Super', my: 'အထူးစီမံခန့်ခွဲသူ', hi: 'सुपर एडमिन', bn: 'সুপার অ্যাডমিন' },
    { en: 'Admin', 'zh-CN': '管理员', 'zh-TW': '管理員', ms: 'Pentadbir', my: 'စီမံခန့်ခွဲသူ', hi: 'व्यवस्थापक', bn: 'প্রশাসক' },
    { en: 'Manager', 'zh-CN': '经理', 'zh-TW': '經理', ms: 'Pengurus', my: 'မန်နေဂျာ', hi: 'प्रबंधक', bn: 'ম্যানেজার' },
    { en: 'Logistics Coordinator', 'zh-CN': '物流协调员', 'zh-TW': '物流協調員', ms: 'Penyelaras Logistik', my: 'ထောက်ပံ့ပို့ဆောင်ရေးညှိနှိုင်းရေးမှူး', hi: 'लॉजिस्टिक्स समन्वयक', bn: 'লজিস্টিকস সমন্বয়কারী' },
    { en: 'Driver', 'zh-CN': '司机', 'zh-TW': '司機', ms: 'Pemandu', my: 'ယာဉ်မောင်း', hi: 'चालक', bn: 'ড্রাইভার' },
    { en: 'HR', 'zh-CN': '人事 / 考勤', 'zh-TW': '人事 / 考勤', ms: 'Sumber Manusia', my: 'လူ့စွမ်းအားအရင်းအမြစ်', hi: 'मानव संसाधन', bn: 'এইচআর' },
    { en: 'Operator', 'zh-CN': '操作员', 'zh-TW': '操作員', ms: 'Operator', my: 'စက်ကိုင်တွယ်သူ', hi: 'ऑपरेटर', bn: 'অপারেটর' },
    { en: 'Sales', 'zh-CN': '业务销售', 'zh-TW': '業務銷售', ms: 'Jualan', my: 'အရောင်း', hi: 'बिक्री', bn: 'বিক্রয়' },
    { en: 'Finance', 'zh-CN': '财务审计', 'zh-TW': '財務審計', ms: 'Kewangan', my: 'ဘဏ္ဍာရေး', hi: 'वित्त', bn: 'অর্থায়ন' },
    { en: 'Guest', 'zh-CN': '访客', 'zh-TW': '訪客', ms: 'Tetamu', my: 'ဧည့်သည်', hi: 'अतिथि', bn: 'অতিথি' },

    // 常用操作 Common Actions
    { en: 'Confirm', 'zh-CN': '确认', 'zh-TW': '確認', ms: 'Sahkan', my: 'အတည်ပြုပါ', hi: 'पुष्टि करें', bn: 'নিশ্চিত করুন' },
    { en: 'Cancel', 'zh-CN': '取消', 'zh-TW': '取消', ms: 'Batal', my: 'ပယ်ဖျက်ပါ', hi: 'रद्द करें', bn: 'বাতিল করুন' },
    { en: 'Submit', 'zh-CN': '提交', 'zh-TW': '提交', ms: 'Hantar', my: 'တင်သွင်းပါ', hi: 'जमा करें', bn: 'জমা দিন' },
    { en: 'Save', 'zh-CN': '保存', 'zh-TW': '儲存', ms: 'Simpan', my: 'သိမ်းဆည်းပါ', hi: 'सहेजें', bn: 'সংরক্ষণ করুন' },
    { en: 'Edit', 'zh-CN': '编辑', 'zh-TW': '編輯', ms: 'Edit', my: 'ပြင်ဆင်ပါ', hi: 'संपादित करें', bn: 'সম্পাদনা করুন' },
    { en: 'Delete', 'zh-CN': '删除', 'zh-TW': '刪除', ms: 'Padam', my: 'ဖျက်ပါ', hi: 'हटाएं', bn: 'মুছুন' },
    { en: 'Search', 'zh-CN': '查询搜索', 'zh-TW': '查詢搜尋', ms: 'Cari', my: 'ရှာဖွေပါ', hi: 'खोजें', bn: 'অনুসন্ধান করুন' },
    { en: 'Reset', 'zh-CN': '重置', 'zh-TW': '重設', ms: 'Set Semula', my: 'ပြန်လည်သတ်မှတ်ပါ', hi: 'रीसेट करें', bn: 'রিসেট করুন' },
    { en: 'Export', 'zh-CN': '导出', 'zh-TW': '匯出', ms: 'Eksport', my: 'ထုတ်ယူပါ', hi: 'निर्यात करें', bn: 'রপ্তানি করুন' },
    { en: 'Refresh', 'zh-CN': '刷新', 'zh-TW': '重新整理', ms: 'Segarkan', my: 'ပြန်လည်စတင်ပါ', hi: 'ताज़ा करें', bn: 'রিফ্রেশ করুন' },
    { en: 'Details', 'zh-CN': '详情', 'zh-TW': '詳情', ms: 'Butiran', my: 'အသေးစိတ်', hi: 'विवरण', bn: 'বিস্তারিত' },
    { en: 'Logout', 'zh-CN': '退出登录', 'zh-TW': '退出登入', ms: 'Log Keluar', my: 'ထွက်မည်', hi: 'लॉग आउट', bn: 'লগআউট' },
    { en: 'Dark', 'zh-CN': '深色', 'zh-TW': '深色', ms: 'Gelap', my: 'အမှောင်', hi: 'गहरा', bn: 'গাঢ়' },
    { en: 'Light', 'zh-CN': '浅色', 'zh-TW': '淺色', ms: 'Cerah', my: 'အလင်း', hi: 'हल्का', bn: 'হালকা' },
    { en: 'Profile', 'zh-CN': '个人主页', 'zh-TW': '個人主頁', ms: 'Profil', my: 'ပရိုဖိုင်', hi: 'प्रोफाइल', bn: 'প্রোফাইল' },
    { en: 'Language', 'zh-CN': '系统语言', 'zh-TW': '系統語言', ms: 'Bahasa', my: 'ဘာသာစကား', hi: 'भाषा', bn: 'ভাষা' },
    { en: 'Loading...', 'zh-CN': '加载中...', 'zh-TW': '載入中...', ms: 'Memuatkan...', my: 'ဖွင့်နေသည်...', hi: 'लोड हो रहा है...', bn: 'লোড হচ্ছে...' },
    { en: 'No data', 'zh-CN': '暂无数据', 'zh-TW': '暫無數據', ms: 'Tiada data', my: 'ဒေတာမရှိပါ', hi: 'कोई डेटा नहीं', bn: 'কোন ডেটা নেই' },

    // 导航分组 Navigation Groups
    { en: 'Executive Suite', 'zh-CN': '管理决策舱', 'zh-TW': '管理決策艙', ms: 'Suit Eksekutif', my: 'အမှုဆောင်ခန်း', hi: 'कार्यकारी कक्ष', bn: 'কার্যনির্বাহী স্যুট' },
    { en: 'Operations', 'zh-CN': '车间作业', 'zh-TW': '車間作業', ms: 'Operasi', my: 'လုပ်ငန်းဆောင်ရွက်မှုများ', hi: 'संचालन', bn: 'অপারেশনস' },
    { en: 'Inventory & BOM', 'zh-CN': '库存与物料', 'zh-TW': '庫存與物料', ms: 'Inventori & BOM', my: 'စာရင်းနှင့် ကုန်ကြမ်း', hi: 'इन्वेंटरी और बीओएम', bn: 'ইনভেন্টরি এবং বিওএম' },
    { en: 'Logistics', 'zh-CN': '物流配送', 'zh-TW': '物流配送', ms: 'Logistik', my: 'ထောက်ပံ့ပို့ဆောင်ရေး', hi: 'लॉजिस्टिक्स', bn: 'লজিস্টিকস' },
    { en: 'Organization', 'zh-CN': '人事与系统', 'zh-TW': '人事與系統', ms: 'Organisasi', my: 'အဖွဲ့အစည်း', hi: 'संगठन', bn: 'সংগঠন' },
    { en: 'Productivity', 'zh-CN': '日常协同', 'zh-TW': '日常協同', ms: 'Produktiviti', my: 'ကုန်ထုတ်စွမ်းအား', hi: 'उत्पादकता', bn: 'উত্পাদনশীলতা' },

    // 导航模块 Navigation Modules
    { en: 'Boss Co-Pilot', 'zh-CN': 'Boss 决策大脑', 'zh-TW': 'Boss 決策大腦', ms: 'Boss Co-Pilot', my: 'Boss Co-Pilot', hi: 'बॉस सह-पायलट', bn: 'বস কো-পাইলট' },
    { en: 'Factory Live OS', 'zh-CN': '全厂实时大屏', 'zh-TW': '全廠實時大屏', ms: 'OS Langsung Kilang', my: 'စက်ရုံတိုက်ရိုက်လွှင့် OS', hi: 'फैक्ट्री लाइव ओएस', bn: 'ফ্যাক্টরি লাইভ ওএস' },
    { en: "William's Dashboard", 'zh-CN': 'William 经营看板', 'zh-TW': 'William 經營看板', ms: "Papan Pemuka William", my: 'ဝီလျံ ဒက်ရှ်ဘုတ်', hi: 'विलियम का डैशबोर्ड', bn: 'উইলিয়ামের ড্যাশবোর্ড' },
    { en: 'Data Command', 'zh-CN': '主数据底座', 'zh-TW': '主數據底座', ms: 'Perintah Data', my: 'အချက်အလက်ညွှန်ကြားချက်', hi: 'डेटा कमांड', bn: 'ডেটা কমান্ড' },
    { en: 'Staff Status & Sign-off', 'zh-CN': '员工状态与交班核准', 'zh-TW': '員工狀態與交班核准', ms: 'Status Kakitangan & Kelulusan', my: 'ဝန်ထမ်းအခြေအနေနှင့် လက်မှတ်ထိုးခြင်း', hi: 'कर्मचारी स्थिति और साइन-ऑफ', bn: 'কর্মীদের অবস্থা এবং অনুমোদন' },
    { en: 'Production Workspace', 'zh-CN': '车间生产工作区', 'zh-TW': '車間生產工作區', ms: 'Ruang Kerja Pengeluaran', my: 'ထုတ်လုပ်မှုလုပ်ငန်းခွင်', hi: 'उत्पादन कार्यक्षेत्र', bn: 'উত্পাদন কর্মক্ষেত্র' },
    { en: 'Multi-Screw & Material Mixing', 'zh-CN': '多螺杆与混料配方', 'zh-TW': '多螺桿與混料配方', ms: 'Campuran Berbilang Skru', my: 'ဝက်အူပေါင်းစုံ ရောစပ်ခြင်း', hi: 'मल्टी-स्क्रू मिक्सिंग', bn: 'মাল্টি-স্ক্রু উপাদান মিশ্রণ' },
    { en: 'Live Stock', 'zh-CN': '成品实时库存', 'zh-TW': '成品實時庫存', ms: 'Stok Langsung', my: 'လက်ရှိလက်ကျန်', hi: 'लाइव स्टॉक', bn: 'লাইভ স্টক' },
    { en: 'Yield & AI Learning', 'zh-CN': '工艺配方与良率', 'zh-TW': '工藝配方與良率', ms: 'Hasil & Pembelajaran AI', my: 'အထွက်နှုန်းနှင့် AI သင်ယူမှု', hi: 'उत्पादकता और एआई', bn: 'ফলন এবং এআই শিক্ষা' },
    { en: 'Machine Schedule', 'zh-CN': '机台排产日历', 'zh-TW': '機台排產日曆', ms: 'Jadual Mesin', my: 'စက်အချိန်ဇယား', hi: 'मशीन अनुसूची', bn: 'মেশিনের সময়সূচী' },
    { en: 'Machine QR Labels', 'zh-CN': '机台二维码标签', 'zh-TW': '機台二維碼標籤', ms: 'Label QR Mesin', my: 'စက် QR အညွှန်း', hi: 'मशीन क्यूआर लेबल', bn: 'মেশিন কিউআর লেবেল' },
    { en: 'Floor Plan', 'zh-CN': '车间布局平面图', 'zh-TW': '車間布局平面圖', ms: 'Pelan Lantai', my: 'ကြမ်းခင်းအစီအစဉ်', hi: 'तल योजना', bn: 'ফ্লোর প্ল্যান' },
    { en: 'Stock Movement', 'zh-CN': '物料出入流水', 'zh-TW': '物料出入流水', ms: 'Pergerakan Stok', my: 'ပစ္စည်းအဝင်အထွက်', hi: 'स्टॉक आंदोलन', bn: 'স্টক মুভমেন্ট' },
    { en: 'Stock Audit', 'zh-CN': '实物盘点核对', 'zh-TW': '實物盤點核對', ms: 'Audit Stok', my: 'ပစ္စည်းစာရင်းစစ်ဆေးခြင်း', hi: 'स्टॉक ऑडिट', bn: 'স্টক অডিট' },
    { en: 'Global Inventory', 'zh-CN': '全局库存总览', 'zh-TW': '全局庫存總覽', ms: 'Inventori Global', my: 'စုစုပေါင်းစာရင်း', hi: 'वैश्विक इन्वेंटरी', bn: 'গ্লোবাল ইনভেন্টরি' },
    { en: 'Product Library', 'zh-CN': '标准物料成品库', 'zh-TW': '標準物料成品庫', ms: 'Pustaka Produk', my: 'ထုတ်ကုန်စာကြည့်တိုက်', hi: 'उत्पाद लाइब्रेरी', bn: 'পণ্য লাইব্রেরি' },
    { en: 'Audit Report', 'zh-CN': '盘点审计报告', 'zh-TW': '盤點審計報告', ms: 'Laporan Audit', my: 'စာရင်းစစ်အစီရင်ခံစာ', hi: 'ऑडिट रिपोर्ट', bn: 'অডিট রিপোর্ট' },
    { en: 'Trip Management', 'zh-CN': '出车调度管理', 'zh-TW': '出車調度管理', ms: 'Pengurusan Perjalanan', my: 'ခရီးစဉ်စီမံခန့်ခွဲမှု', hi: 'यात्रा प्रबंधन', bn: 'ট্রিপ পরিচালনা' },
    { en: 'My Deliveries', 'zh-CN': '司机送货任务', 'zh-TW': '司機送貨任務', ms: 'Penghantaran Saya', my: 'ကျွန်ုပ်၏ပို့ဆောင်မှုများ', hi: 'मेरी डिलीवरी', bn: 'আমার বিতরণ' },
    { en: 'Delivery History', 'zh-CN': '出车历史记录', 'zh-TW': '出車歷史記錄', ms: 'Sejarah Penghantaran', my: 'ပို့ဆောင်မှုသမိုင်း', hi: 'वितरण इतिहास', bn: 'বিতরণ ইতিহাস' },
    { en: 'Daily Prep', 'zh-CN': '每日发货备货', 'zh-TW': '每日發貨備貨', ms: 'Penyediaan Harian', my: 'နေ့စဉ်ပြင်ဆင်မှု', hi: 'दैनिक तैयारी', bn: 'দৈনিক প্রস্তুতি' },
    { en: 'Maintenance Control', 'zh-CN': '设备维保管理', 'zh-TW': '設備維保管理', ms: 'Kawalan Penyelenggaraan', my: 'ထိန်းသိမ်းမှုထိန်းချုပ်ရေး', hi: 'रखरखाव नियंत्रण', bn: 'রক্ষণাবেক্ষণ নিয়ন্ত্রণ' },
    { en: 'Lorry Fleet', 'zh-CN': '货车车队档案', 'zh-TW': '貨車車隊檔案', ms: 'Armada Lori', my: 'ကုန်တင်ကားအုပ်စု', hi: 'लॉरी बेड़ा', bn: 'লরি ফ্লিট' },
    { en: 'Lorry Service', 'zh-CN': '车辆维保报修', 'zh-TW': '車輛維保報修', ms: 'Servis Lori', my: 'ကားပြုပြင်ထိန်းသိမ်းမှု', hi: 'लॉरी सेवा', bn: 'লরি সার্ভিস' },
    { en: 'Driver Management', 'zh-CN': '司机运力档案', 'zh-TW': '司機運力檔案', ms: 'Pengurusan Pemandu', my: 'ယာဉ်မောင်းစီမံခန့်ခွဲမှု', hi: 'चालक प्रबंधन', bn: 'ড্রাইভার পরিচালনা' },
    { en: 'Production Logs', 'zh-CN': '生产班次日志', 'zh-TW': '生產班次日誌', ms: 'Log Pengeluaran', my: 'ထုတ်လုပ်မှုမှတ်တမ်း', hi: 'उत्पादन लॉग', bn: 'উত্পাদন লগ' },
    { en: 'Report History', 'zh-CN': '历史发货报告', 'zh-TW': '歷史發貨報告', ms: 'Sejarah Laporan', my: 'အစီရင်ခံစာသမိုင်း', hi: 'रिपोर्ट इतिहास', bn: 'প্রতিবেদন ইতিহাস' },
    { en: 'Staff Hub', 'zh-CN': '员工服务台 / 考勤', 'zh-TW': '員工服務台 / 考勤', ms: 'Hab Pekerja', my: 'ဝန်ထမ်းဗဟို', hi: 'कर्मचारी हब', bn: 'কর্মী হাব' },
    { en: 'Apply Leave', 'zh-CN': '员工请假申请', 'zh-TW': '員工請假申請', ms: 'Mohon Cuti', my: 'ခွင့်လျှောက်ထားပါ', hi: 'छुट्टी आवेदन', bn: 'ছুটির আবেদন' },
    { en: 'HR Control Center', 'zh-CN': '人事与权限中心', 'zh-TW': '人事與權限中心', ms: 'Pusat Kawalan HR', my: 'HR ထိန်းချုပ်ရေးစင်တာ', hi: 'एचआर नियंत्रण केंद्र', bn: 'এইচআর নিয়ন্ত্রণ কেন্দ্র' },
    { en: 'Executive Reports', 'zh-CN': '管理层综合报表', 'zh-TW': '管理層綜合報表', ms: 'Laporan Eksekutif', my: 'အမှုဆောင်အစီရင်ခံစာများ', hi: 'कार्यकारी रिपोर्ट', bn: 'কার্যনির্বাহী রিপোর্ট' },
    { en: 'IOT SETTINGS', 'zh-CN': '物联网硬件设置', 'zh-TW': '物聯網硬件設置', ms: 'Tetapan IOT', my: 'IOT ဆက်တင်များ', hi: 'आईओटी सेटिंग्स', bn: 'আইওটি সেটিংস' },
    { en: 'Dev Log', 'zh-CN': '系统开发日志', 'zh-TW': '系統開發日誌', ms: 'Log Pembangun', my: 'ဆော့ဖ်ဝဲမှတ်တမ်း', hi: 'देव लॉग', bn: 'ডেভ লগ' },
    { en: 'Activity Logs', 'zh-CN': '系统操作日志', 'zh-TW': '系統操作日誌', ms: 'Log Aktiviti', my: 'လှုပ်ရှားမှုမှတ်တမ်းများ', hi: 'गतिविधि लॉग', bn: 'কার্যকলাপ লগ' },
    { en: 'My Monthly Report', 'zh-CN': '个人出勤月报', 'zh-TW': '個人出勤月報', ms: 'Laporan Bulanan Saya', my: 'ကျွန်ုပ်၏လစဉ်အစီရင်ခံစာ', hi: 'मेरी मासिक रिपोर्ट', bn: 'আমার মাসিক রিপোর্ট' },
    { en: 'SOP Center', 'zh-CN': 'SOP 标准指引', 'zh-TW': 'SOP 標準指引', ms: 'Pusat SOP', my: 'SOP စင်တာ', hi: 'एसओपी केंद्र', bn: 'এসওপি কেন্দ্র' },
    { en: 'Work Photos', 'zh-CN': '现场作业拍照', 'zh-TW': '現場作業拍照', ms: 'Foto Kerja', my: 'အလုပ်ဓာတ်ပုံများ', hi: 'कार्य तस्वीरें', bn: 'কাজের ছবি' },
    { en: 'Notes', 'zh-CN': '日常工作便签', 'zh-TW': '日常工作便簽', ms: 'Nota', my: 'မှတ်စုများ', hi: 'नोट्स', bn: 'নোট' },
    { en: 'Tasks', 'zh-CN': '协同任务看板', 'zh-TW': '協同任務看板', ms: 'Tugasan', my: 'တာဝန်များ', hi: 'कार्य', bn: 'টাস্ক' },
    // 员工状态与交班核准 Staff Status & Sign-Off Terminology
    { en: 'Staff Status & Sign-off', 'zh-CN': '员工状态与交班核准', 'zh-TW': '員工狀態與交班核准', ms: 'Status Staf & Pengesahan', my: 'ဝန်ထမ်းအခြေအနေနှင့် အတည်ပြုချက်', hi: 'कर्मचारी स्थिति और साइन-ऑफ', bn: 'কর্মীদের অবস্থা এবং অনুমোদন' },
    { en: 'Live Staff Status, Plant Breakdown & Shift Sign-off', 'zh-CN': '全厂多岗位状态实时监控 · 厂区分类透视 · 下班工时核验 · 现场打钩交班', 'zh-TW': '全廠多崗位狀態實時監控 · 廠區分類透視 · 下班工時核驗 · 現場打鉤交班', ms: 'Pemantauan Status Staf Masa Nyata · Pecahan Mengikut Kilang · Pengesahan Jam Tamat Syif', my: 'ဝန်ထမ်းအခြေအနေတိုက်ရိုက်စောင့်ကြည့်ခြင်း · စက်ရုံအလိုက်ခွဲခြားခြင်း · အလုပ်ပြီးချိန်အတည်ပြုခြင်း', hi: 'वास्तविक समय कर्मचारी स्थिति · संयंत्र वर्गीकरण · शिफ्ट साइन-ऑफ', bn: 'রিয়েল-টাইম স্টাফ স্ট্যাটাস · প্ল্যান্ট ব্রেকডাউন · শিফট সাইন-অফ' },
    { en: 'Plant Region', 'zh-CN': '厂区地区', 'zh-TW': '廠區地區', ms: 'Kawasan Kilang', my: 'စက်ရုံတည်နေရာ', hi: 'संयंत्र क्षेत्र', bn: 'কারখানা অঞ্চল' },
    { en: 'All Plants', 'zh-CN': '全部地区', 'zh-TW': '全部地區', ms: 'Semua Kawasan', my: 'နေရာအားလုံး', hi: 'सभी क्षेत्र', bn: 'সমস্ত অঞ্চল' },
    { en: 'All Locations', 'zh-CN': '全部地区', 'zh-TW': '全部地區', ms: 'Semua Lokasi', my: 'နေရာအားလုံး', hi: 'सभी स्थान', bn: 'সমস্ত অবস্থান' },
    { en: 'Taiping Plant', 'zh-CN': '太平总厂', 'zh-TW': '太平總廠', ms: 'Kilang Utama Taiping', my: 'ထိုင်းပင်ပင်မစက်ရုံ', hi: 'ताइपिंग मुख्य संयंत्र', bn: 'তাইপিং প্রধান কারখানা' },
    { en: 'Nilai Plant', 'zh-CN': '汝来分厂', 'zh-TW': '汝來分廠', ms: 'Cawangan Nilai', my: 'နီလိုင်စက်ရုံခွဲ', hi: 'निलाई शाखा', bn: 'নিলাই শাখা' },
    { en: 'Johor Plant', 'zh-CN': '柔佛分厂', 'zh-TW': '柔佛分廠', ms: 'Cawangan Johor', my: 'ဂျိုဟိုးစက်ရုံခွဲ', hi: 'जोहोर शाखा', bn: 'জোহর শাখা' },
    { en: 'Kelantan Plant', 'zh-CN': '吉兰丹分厂', 'zh-TW': '吉蘭丹分廠', ms: 'Cawangan Kelantan', my: 'ကလန်တန်စက်ရုံခွဲ', hi: 'केलांतन शाखा', bn: 'কেলান্তান শাখা' },
    { en: 'Group by Plant', 'zh-CN': '按厂区分栏', 'zh-TW': '按廠區分欄', ms: 'Kumpul Mengikut Kilang', my: 'စက်ရုံအလိုက်ခွဲထားသည်', hi: 'संयंत्र द्वारा समूह', bn: 'কারখানা অনুসারে গ্রুপ' },
    { en: 'List', 'zh-CN': '列表', 'zh-TW': '列表', ms: 'Senarai', my: 'စာရင်း', hi: 'सूची', bn: 'তালিকা' },
    { en: 'All Roles', 'zh-CN': '全部岗位', 'zh-TW': '全部崗位', ms: 'Semua Jawatan', my: 'ရာထူးအားလုံး', hi: 'सभी पद', bn: 'সমস্ত পদ' },
    { en: 'Machine Operator', 'zh-CN': '机台操作员', 'zh-TW': '機台操作員', ms: 'Operator Mesin', my: 'စက်ကိုင်တွယ်သူ', hi: 'मशीन ऑपरेटर', bn: 'মেশিন অপারেটর' },
    { en: 'Logistics Driver', 'zh-CN': '物流司机', 'zh-TW': '物流司機', ms: 'Pemandu Logistik', my: 'ယာဉ်မောင်း', hi: 'रसद चालक', bn: 'লজিস্টিক ড্রাইভার' },
    { en: 'Warehouse Staff', 'zh-CN': '仓库仓管', 'zh-TW': '倉庫倉管', ms: 'Pengurus Gudang', my: 'ဂိုဒေါင်ဝန်ထမ်း', hi: 'गोदाम कर्मचारी', bn: 'গুদাম কর্মী' },
    { en: 'Admin / Office', 'zh-CN': '行政/管理', 'zh-TW': '行政/管理', ms: 'Pentadbiran / Pejabat', my: 'ရုံး / စီမံခန့်ခွဲမှု', hi: 'प्रशासन / कार्यालय', bn: 'প্রশাসন / অফিস' },
    { en: 'All Statuses', 'zh-CN': '全部状态', 'zh-TW': '全部狀態', ms: 'Semua Status', my: 'အခြေအနေအားလုံး', hi: 'सभी स्थितियां', bn: 'সমস্ত অবস্থা' },
    { en: 'Pending Review', 'zh-CN': '待审核', 'zh-TW': '待審核', ms: 'Menunggu Pengesahan', my: 'စစ်ဆေးရန်ကျန်ရှိသည်', hi: 'समीक्षाधीन', bn: 'পর্যালোচনাধীন' },
    { en: 'Active On-Duty', 'zh-CN': '在岗中', 'zh-TW': '在崗中', ms: 'Sedang Bertugas', my: 'တာဝန်ထမ်းဆောင်နေသည်', hi: 'ड्यूटी पर', bn: 'ডিউটিতে' },
    { en: 'Approved', 'zh-CN': '已核准', 'zh-TW': '已核准', ms: 'Telah Disahkan', my: 'အတည်ပြုပြီး', hi: 'स्वीकृत', bn: 'অনুমোদিত' },
    { en: 'Absent / Leave', 'zh-CN': '未出勤/请假', 'zh-TW': '未出勤/請假', ms: 'Tidak Hadir / Cuti', my: 'ပျက်ကွက် / ခွင့်ရက်', hi: 'अनुपस्थित / छुट्टी', bn: 'অনুপস্থিত / ছুটি' },
    { en: 'Sign Off', 'zh-CN': '打钩核准', 'zh-TW': '打鉤核准', ms: 'Sahkan & Tandatangan', my: 'အတည်ပြုလက်မှတ်ထိုးပါ', hi: 'साइन ऑफ करें', bn: 'সাইন অফ করুন' },
    { en: 'Batch Approve All', 'zh-CN': '一键全审', 'zh-TW': '一鍵全審', ms: 'Sahkan Semua', my: 'အားလုံးအတည်ပြုပါ', hi: 'सभी स्वीकृत करें', bn: 'সব অনুমোদন করুন' },
    { en: 'Adjust Hours', 'zh-CN': '微调工时', 'zh-TW': '微調工時', ms: 'Laras Jam Kerja', my: 'အလုပ်ချိန်ညှိပါ', hi: 'घंटे समायोजित करें', bn: 'সময় সামঞ্জস্য করুন' },
    { en: 'Active Working', 'zh-CN': '在岗作业中', 'zh-TW': '在崗作業中', ms: 'Sedang Beroperasi', my: 'လက်ရှိလုပ်ဆောင်နေသည်', hi: 'कार्यरत', bn: 'সক্রিয়ভাবে কাজ করছে' },
    { en: 'Clocked Out · Pending Review', 'zh-CN': '已下班 · 待审核', 'zh-TW': '已下班 · 待審核', ms: 'Tamat Syif · Menunggu Pengesahan', my: 'အလုပ်ဆင်းပြီး · စစ်ဆေးရန်ကျန်သည်', hi: 'क्लॉक आउट · समीक्षा लंबित', bn: 'ক্লক আউট · পর্যালোচনা মুলতুবি' },
    { en: 'Shift Approved', 'zh-CN': '已核准结班', 'zh-TW': '已核准結班', ms: 'Syif Disahkan Selesai', my: 'ဆိုင်းပြီးဆုံး၍ အတည်ပြုပြီး', hi: 'शिफ्ट स्वीकृत', bn: 'শিফট অনুমোদিত' },
    { en: 'Absent (No Clock-In)', 'zh-CN': '未出勤 (无打卡)', 'zh-TW': '未出勤 (無打卡)', ms: 'Tidak Hadir (Tiada Jam Masuk)', my: 'မလာပါ (ကတ်မထိုးပါ)', hi: 'अनुपस्थित (कोई क्लॉक-इन नहीं)', bn: 'অনুপস্থিত (কোনো ক্লক-ইন নেই)' },
    { en: 'On Leave (Approved Leave)', 'zh-CN': '休假中 (Approved Leave)', 'zh-TW': '休假中 (Approved Leave)', ms: 'Bercuti (Diluluskan)', my: 'ခွင့်ရက် (အတည်ပြုပြီး)', hi: 'छुट्टी पर', bn: 'ছুটিতে' },
    { en: 'Clock Times / Hours', 'zh-CN': '打卡时间 / 工时', 'zh-TW': '打卡時間 / 工時', ms: 'Masa Jam / Tempoh', my: 'ကတ်ထိုးချိန် / အလုပ်ချိန်', hi: 'समय / घंटे', bn: 'সময় / ঘন্টা' },
    { en: 'Work Details', 'zh-CN': '现场作业详情', 'zh-TW': '現場作業詳情', ms: 'Butiran Kerja Lapangan', my: 'လုပ်ငန်းအသေးစိတ်', hi: 'कार्य विवरण', bn: 'কাজের বিবরণ' },
    { en: 'Verified & Locked', 'zh-CN': '已核准锁定', 'zh-TW': '已核准鎖定', ms: 'Disahkan & Dikunci', my: 'အတည်ပြုပြီးသော့ခတ်ထားသည်', hi: 'सत्यापित और बंद', bn: 'যাচাইকৃত এবং লক' },
    { en: 'Manual Clock-Out / Shift End', 'zh-CN': '现场补卡 / 结班', 'zh-TW': '現場補卡 / 結班', ms: 'Tamat Syif Manual', my: 'အလုပ်ဆင်းလက်မှတ်ထိုးပါ', hi: 'मैनुअल क्लॉक-आउट', bn: 'ম্যানুয়াল ক্লক-আউট' },
    { en: 'Manual Clock-In', 'zh-CN': '补录考勤', 'zh-TW': '補錄考勤', ms: 'Daftar Masuk Manual', my: 'ကတ်ပြန်ထိုးပါ', hi: 'मैनुअल उपस्थिति', bn: 'ম্যানুয়াল উপস্থিতি' },
    { en: 'Adjust Attendance Hours & Verification', 'zh-CN': '微调考勤工时与核对', 'zh-TW': '微調考勤工時與核對', ms: 'Laras Jam Kehadiran & Pengesahan', my: 'တက်ရောက်မှုအချိန်ညှိပါ', hi: 'उपस्थिति घंटे समायोजित करें', bn: 'উপস্থিতির সময় সামঞ্জস্য করুন' },
    { en: 'Clock In Time', 'zh-CN': '上班打卡时间 (Clock In)', 'zh-TW': '上班打卡時間 (Clock In)', ms: 'Masa Masuk Bertugas', my: 'အလုပ်စတင်ချိန်', hi: 'काम शुरू समय', bn: 'কাজে যোগদানের সময়' },
    { en: 'Clock Out Time', 'zh-CN': '下班打卡时间 (Clock Out)', 'zh-TW': '下班打卡時間 (Clock Out)', ms: 'Masa Keluar Bertugas', my: 'အလုပ်ပြီးချိန်', hi: 'काम समाप्त समय', bn: 'কাজ শেষের সময়' },
    { en: 'Effective Hours Worked', 'zh-CN': '核算有效工时 (小时)', 'zh-TW': '核算有效工時 (小時)', ms: 'Jam Kerja Berkesan (Jam)', my: 'အမှန်တကယ်အလုပ်ချိန် (နာရီ)', hi: 'प्रभावी कार्य घंटे', bn: 'কার্যকর কাজের সময়' },
    { en: 'Bound Machine (Optional)', 'zh-CN': '绑定机台 (可选)', 'zh-TW': '綁定機台 (可選)', ms: 'Mesin Ditetapkan (Pilihan)', my: 'စက်သတ်မှတ်ပါ (ရွေးချယ်နိုင်သည်)', hi: 'मशीन लिंक (वैकल्पिक)', bn: 'মেশিন লিংক (ঐচ্ছিক)' },
    { en: 'Adjustment Notes', 'zh-CN': '微调备注说明 / 核验记录', 'zh-TW': '微調備註說明 / 核驗記錄', ms: 'Nota Pelarasan / Rekod Pengesahan', my: 'မှတ်စုများနှင့် အတည်ပြုချက်မှတ်တမ်း', hi: 'समायोजन नोट्स', bn: 'সমন্বয় নোট' },
    { en: 'Save and Approve Directly', 'zh-CN': '保存并直接完成打钩核准 (锁定结班)', 'zh-TW': '保存並直接完成打鉤核准 (鎖定結班)', ms: 'Simpan & Sahkan Terus (Kunci Syif)', my: 'သိမ်းဆည်းပြီးတိုက်ရိုက်အတည်ပြုပါ', hi: 'सहेजें और सीधे स्वीकृत करें', bn: 'সংরক্ষণ করুন এবং সরাসরি অনুমোদন করুন' },
    { en: 'Save Record', 'zh-CN': '保存记录', 'zh-TW': '保存記錄', ms: 'Simpan Rekod', my: 'မှတ်တမ်းသိမ်းပါ', hi: 'रिकॉर्ड सहेजें', bn: 'রেকর্ড সংরক্ষণ করুন' },
    { en: 'Batch Approve Plant', 'zh-CN': '本厂一键全审', 'zh-TW': '本廠一鍵全審', ms: 'Sahkan Kilang Ini', my: 'ဤစက်ရုံအားလုံးအတည်ပြုပါ', hi: 'इस संयंत्र के सभी स्वीकृत करें', bn: 'এই কারখানার সমস্ত অনুমোদন করুন' },
    { en: 'Active Plant Focus', 'zh-CN': '当前专注厂区', 'zh-TW': '當前專注廠區', ms: 'Fokus Kilang Semasa', my: 'လက်ရှိရွေးချယ်ထားသောစက်ရုံ', hi: 'सक्रिय संयंत्र', bn: 'বর্তমান কারখানা' },
    { en: 'Clear Filter (View All)', 'zh-CN': '清除筛选 (查看全厂)', 'zh-TW': '清除篩選 (查看全廠)', ms: 'Kosongkan Penapis (Lihat Semua)', my: 'ဖျက်ပါ (အားလုံးကြည့်ပါ)', hi: 'फ़िल्टर हटाएं (सभी देखें)', bn: 'ফিল্টার মুছুন (সমস্ত দেখুন)' },
    { en: 'Search by Name / ID / Machine / Region...', 'zh-CN': '搜索姓名 / 工号 / 机台 / 地区...', 'zh-TW': '搜尋姓名 / 工號 / 機台 / 地區...', ms: 'Cari Nama / No. ID / Mesin / Wilayah...', my: 'အမည် / ID / စက် / နေရာ ရှာပါ...', hi: 'नाम / आईडी / मशीन / क्षेत्र खोजें...', bn: 'নাম / আইডি / মেশিন / এলাকা অনুসন্ধান করুন...' },
    { en: 'Back to Today', 'zh-CN': '回到今天', 'zh-TW': '回到今天', ms: 'Kembali Ke Hari Ini', my: 'ယနေ့သို့ပြန်သွားပါ', hi: 'आज पर वापस जाएँ', bn: 'আজকে ফিরে যান' },
    { en: 'Previous Day', 'zh-CN': '前一天', 'zh-TW': '前一天', ms: 'Hari Sebelumnya', my: 'ယခင်နေ့', hi: 'पिछला दिन', bn: 'আগের দিন' },
    { en: 'Next Day', 'zh-CN': '后一天', 'zh-TW': '後一天', ms: 'Hari Seterusnya', my: 'နောက်တစ်နေ့', hi: 'अगला दिन', bn: 'পরের দিন' },
    { en: 'Refresh Data', 'zh-CN': '刷新数据', 'zh-TW': '重新整理數據', ms: 'Segarkan Data', my: 'ဒေတာပြန်လည်စတင်ပါ', hi: 'डेटा ताज़ा करें', bn: 'ডেটা রিফ্রেশ করুন' },
    { en: 'Total Enrolled Staff', 'zh-CN': '全厂在册员工', 'zh-TW': '全廠在冊員工', ms: 'Jumlah Pekerja Berdaftar', my: 'စုစုပေါင်းဝန်ထမ်းဦးရေ', hi: 'कुल पंजीकृत कर्मचारी', bn: 'মোট নিবন্ধিত কর্মী' },
    { en: 'Total Active Employees', 'zh-CN': '激活状态员工总数', 'zh-TW': '激活狀態員工總數', ms: 'Jumlah Pekerja Aktif', my: 'အလုပ်လုပ်နေသောဝန်ထမ်းများ', hi: 'सक्रिय कर्मचारियों की कुल संख्या', bn: 'মোট সক্রিয় कर्मचारी' },
    { en: 'Machine / Driver / Tasks', 'zh-CN': '机台/司机/专项作业', 'zh-TW': '機台/司機/專項作業', ms: 'Mesin / Pemandu / Tugasan Khas', my: 'စက် / ယာဉ်မောင်း / အထူးအလုပ်များ', hi: 'मशीन / चालक / विशेष कार्य', bn: 'মেশিন / চালক / বিশেষ কাজ' },
    { en: 'Requires Manager Sign-off', 'zh-CN': '需经理逐项打钩核准', 'zh-TW': '需經理逐項打鉤核准', ms: 'Memerlukan Pengesahan Pengurus', my: 'မန်နေဂျာအတည်ပြုချက်လိုအပ်သည်', hi: 'प्रबंधक हस्ताक्षर आवश्यक', bn: 'ম্যানেজার অনুমোদন প্রয়োজন' },
    { en: 'Verified and Locked by Manager', 'zh-CN': '经理已确认锁定', 'zh-TW': '經理已確認鎖定', ms: 'Disahkan & Dikunci Pengurus', my: 'မန်နေဂျာအတည်ပြုပြီးသော့ခတ်ထားသည်', hi: 'प्रबंधक द्वारा सत्यापित और बंद', bn: 'ম্যানেজার দ্বারা যাচাই এবং লক' },
    { en: 'No Clock-in Record Today', 'zh-CN': '今日无打卡记录', 'zh-TW': '今日無打卡記錄', ms: 'Tiada Rekod Jam Masuk Hari Ini', my: 'ယနေ့ကတ်ထိုးမှတ်တမ်းမရှိပါ', hi: 'आज कोई उपस्थिति रिकॉर्ड नहीं है', bn: 'আজ কোনো উপস্থিতির রেকর্ড নেই' },
    { en: 'No Matching Staff Records', 'zh-CN': '未找到符合条件的员工记录', 'zh-TW': '未找到符合條件的員工記錄', ms: 'Tiada Rekod Pekerja Dijumpai', my: 'ကိုက်ညီသောဝန်ထမ်းမှတ်တမ်းမရှိပါ', hi: 'कोई रिकॉर्ड नहीं मिला', bn: 'কোনো রেকর্ড পাওয়া যায়নি' },
    { en: 'Please adjust the filters or search criteria', 'zh-CN': '请尝试调整上方地区、岗位或状态筛选条件', 'zh-TW': '請嘗試調整上方地區、崗位或狀態篩選條件', ms: 'Sila laraskan penapis atau kriteria carian', my: 'ကျေးဇူးပြု၍ စစ်ထုတ်မှုများကိုချိန်ညှိပါ', hi: 'कृपया फ़िल्टर समायोजित करें', bn: 'দয়া করে ফিল্টার সামঞ্জস্য করুন' },
    { en: 'Assigned Plant Region', 'zh-CN': '所属厂区地区', 'zh-TW': '所屬廠區地區', ms: 'Wilayah Kilang Ditugaskan', my: 'သက်ဆိုင်ရာစက်ရုံဒေသ', hi: 'संबंधित संयंत्र क्षेत्र', bn: 'নির্ধারিত কারখানা অঞ্চল' },
    { en: 'Current Status', 'zh-CN': '当前状态', 'zh-TW': '當前狀態', ms: 'Status Semasa', my: 'လက်ရှိအခြေအနေ', hi: 'वर्तमान स्थिति', bn: 'বর্তমান অবস্থা' },
    { en: 'Effective Hours', 'zh-CN': '核算工时', 'zh-TW': '核算工時', ms: 'Jam Berkesan', my: 'အလုပ်ချိန်', hi: 'प्रभावी घंटे', bn: 'কার্যকর ঘন্টা' },
    { en: 'In Progress', 'zh-CN': '进行中', 'zh-TW': '進行中', ms: 'Sedang Berjalan', my: 'လုပ်ဆောင်နေသည်', hi: 'प्रगति में', bn: 'চলমান' },
    { en: 'Daily Attendance Clock-In', 'zh-CN': '日常考勤打卡', 'zh-TW': '日常考勤打卡', ms: 'Kehadiran Harian', my: 'နေ့စဉ်တက်ရောက်မှု', hi: 'दैनिक उपस्थिति', bn: 'দৈনিক উপস্থিতি' },
    { en: 'Revert Approval', 'zh-CN': '撤销核准', 'zh-TW': '撤銷核准', ms: 'Batalkan Pengesahan', my: 'အတည်ပြုချက်ပြန်ဖျက်ပါ', hi: 'स्वीकृति रद्द करें', bn: 'অনুমোদন প্রত্যাহার' },
    { en: 'Edit Record', 'zh-CN': '修改记录', 'zh-TW': '修改記錄', ms: 'Edit Rekod', my: 'မှတ်တမ်းပြင်ဆင်ပါ', hi: 'रिकॉर्ड संपादित करें', bn: 'রেকর্ড সম্পাদনা' },
    { en: 'Taiping', 'zh-CN': '太平', 'zh-TW': '太平', ms: 'Taiping', my: 'ထိုင်းပင်', hi: 'ताइपिंग', bn: 'তাইপিং' },
    { en: 'Nilai', 'zh-CN': '汝来', 'zh-TW': '汝來', ms: 'Nilai', my: 'နီလိုင်', hi: 'निलाई', bn: 'নিলাই' },
    { en: 'Johor', 'zh-CN': '柔佛', 'zh-TW': '柔佛', ms: 'Johor', my: 'ဂျိုဟိုး', hi: 'जोहोर', bn: 'জোহর' },
    { en: 'Kelantan', 'zh-CN': '吉兰丹', 'zh-TW': '吉蘭丹', ms: 'Kelantan', my: 'ကလန်တန်', hi: 'केलांतन', bn: 'কেলান্তান' },

    // Staff Status Sign-off 现场词汇与交互弹窗
    { en: 'Clocked Out · Pending Review', 'zh-CN': '下班待审核', 'zh-TW': '下班待審核', ms: 'Tamat Syif · Menunggu Pengesahan', my: 'အလုပ်ဆင်းပြီး · စစ်ဆေးရန်ကျန်သည်', hi: 'क्लॉक आउट · समीक्षा लंबित', bn: 'ক্লক আউট · পর্যালোচনা মুলতুবি' },
    { en: 'Absent / Leave', 'zh-CN': '未出勤 / 请假', 'zh-TW': '未出勤 / 請假', ms: 'Tidak Hadir / Cuti', my: 'ပျက်ကွက် / ခွင့်ရက်', hi: 'अनुपस्थित / छुट्टी', bn: 'অনুপস্থিত / ছুটি' },
    { en: 'Role', 'zh-CN': '岗位', 'zh-TW': '崗位', ms: 'Jawatan', my: 'ရာထူး', hi: 'पद', bn: 'পদ' },
    { en: 'Fetching real-time attendance and workflow status across plants...', 'zh-CN': '正在实时拉取各厂区全员考勤与工作流状态...', 'zh-TW': '正在實時拉取各廠區全員考勤與工作流狀態...', ms: 'Memuatkan kehadiran masa nyata & status aliran kerja merentas kilang...', my: 'စက်ရုံများအနှံ့ တက်ရောက်မှုနှင့် အလုပ်အခြေအနေများကို ရယူနေသည်...', hi: 'संयंत्रों में वास्तविक समय उपस्थिति और कार्यप्रवाह स्थिति प्राप्त की जा रही है...', bn: 'প্ল্যান্ট জুড়ে রিয়েল-টাইম উপস্থিতি এবং কাজের অবস্থা আনা হচ্ছে...' },
    { en: 'Compact List View', 'zh-CN': '紧凑列表视图', 'zh-TW': '緊湊列表視圖', ms: 'Paparan Senarai Ringkas', my: 'ကျစ်လစ်သောစာရင်း', hi: 'संक्षिप्त सूची दृश्य', bn: 'সংক্ষিপ্ত তালিকা দৃশ্য' },
    { en: 'Group by Region Board', 'zh-CN': '按地区分栏看板', 'zh-TW': '按地區分欄看板', ms: 'Papan Kumpulan Wilayah', my: 'ဒေသအလိုက်ခွဲထားသောဘုတ်', hi: 'क्षेत्र समूह बोर्ड', bn: 'অঞ্চল গ্রুপ বোর্ড' },
    { en: 'Optional: Missed punch reason, hour adjustment notes...', 'zh-CN': '选填: 现场漏打卡原因、工时调整说明...', 'zh-TW': '選填: 現場漏打卡原因、工時調整說明...', ms: 'Pilihan: Sebab terlepas jam, nota pelarasan masa...', my: 'ရွေးချယ်နိုင်သည်: ကတ်မထိုးရခြင်းအကြောင်းရင်း၊ အချိန်ညှိချက်မှတ်စု...', hi: 'वैकल्पिक: क्लॉक-इन छूटने का कारण, समायोजन नोट्स...', bn: 'ঐচ্ছিক: মিসড পাঞ্চের কারণ, সময় সমন্বয়ের নোট...' },
    { en: 'e.g. J1 / T1-M03', 'zh-CN': '例: J1 / T1-M03', 'zh-TW': '例: J1 / T1-M03', ms: 'Cth: J1 / T1-M03', my: 'ဥပမာ: J1 / T1-M03', hi: 'उदा: J1 / T1-M03', bn: 'যেমন: J1 / T1-M03' },
    { en: 'Adjust hours or notes', 'zh-CN': '微调工时或补充说明', 'zh-TW': '微調工時或補充說明', ms: 'Laras jam atau nota', my: 'အလုပ်ချိန်ညှိပါ သို့မဟုတ် မှတ်စုထည့်ပါ', hi: 'घंटे या नोट्स समायोजित करें', bn: 'সময় বা নোট সামঞ্জস্য করুন' },
    { en: '· KPI cards and list auto-filtered', 'zh-CN': '· 统计卡片与列表已自动联动过滤', 'zh-TW': '· 統計卡片與列表已自動連動過濾', ms: '· Kad statistik & senarai ditapis secara automatik', my: '· စာရင်းအင်းကတ်များနှင့် စာရင်းကို အလိုအလျောက် စစ်ထုတ်ထားသည်', hi: '· आंकड़े कार्ड और सूची स्वतः फ़िल्टर की गई', bn: '· পরিসংখ্যান কার্ড এবং তালিকা স্বয়ংক্রিয়ভাবে ফিল্টার করা হয়েছে' },
    { en: 'Enrolled', 'zh-CN': '在册', 'zh-TW': '在冊', ms: 'Berdaftar', my: 'စာရင်းသွင်းပြီး', hi: 'पंजीकृत', bn: 'নিবন্ধিত' },
    { en: 'Total', 'zh-CN': '共', 'zh-TW': '共', ms: 'Jumlah', my: 'စုစုပေါင်း', hi: 'कुल', bn: 'মোট' },
    { en: 'staff', 'zh-CN': '人', 'zh-TW': '人', ms: 'orang', my: 'ဦး', hi: 'लोग', bn: 'জন' },
    { en: 'on duty', 'zh-CN': '人在岗', 'zh-TW': '人在崗', ms: 'sedang bertugas', my: 'တာဝန်ထမ်းဆောင်နေသူ', hi: 'ड्यूटी पर', bn: 'ডিউটিতে আছেন' },
    { en: 'pending review', 'zh-CN': '人待审核', 'zh-TW': '人待審核', ms: 'menunggu semakan', my: 'စစ်ဆေးရန်ကျန်', hi: 'समीक्षा लंबित', bn: 'অনুমোদনের অপেক্ষায়' },
    { en: 'All approved', 'zh-CN': '全部已审核', 'zh-TW': '全部已審核', ms: 'Semua diluluskan', my: 'အားလုံးအတည်ပြုပြီး', hi: 'सभी स्वीकृत', bn: 'সমস্ত অনুমোদিত' },
    { en: 'Machine', 'zh-CN': '机台', 'zh-TW': '機台', ms: 'Mesin', my: 'စက်', hi: 'मशीन', bn: 'মেশিন' },
    { en: 'Product', 'zh-CN': '产品', 'zh-TW': '產品', ms: 'Produk', my: 'ထုတ်ကုန်', hi: 'उत्पाद', bn: 'পণ্য' },
    { en: 'Output', 'zh-CN': '产出', 'zh-TW': '產出', ms: 'Hasil', my: 'ထွက်ရှိမှု', hi: 'उत्पादन', bn: 'আউটপুট' },
    { en: 'Rolls', 'zh-CN': '卷', 'zh-TW': '卷', ms: 'Gulung', my: 'လိပ်', hi: 'रोल', bn: 'রোল' },
    { en: 'Special', 'zh-CN': '专项', 'zh-TW': '專項', ms: 'Khas', my: 'အထူး', hi: 'विशेष', bn: 'विशेष' },
    { en: 'In', 'zh-CN': '入', 'zh-TW': '入', ms: 'Masuk', my: 'အဝင်', hi: 'अंदर', bn: 'প্রবেশ' },
    { en: 'Out', 'zh-CN': '出', 'zh-TW': '出', ms: 'Keluar', my: 'အထွက်', hi: 'बाहर', bn: 'প্রস্থান' },
    { en: 'Delivering', 'zh-CN': '配送中', 'zh-TW': '配送中', ms: 'Dalam Penghantaran', my: 'ပို့ဆောင်နေသည်', hi: 'वितरण जारी है', bn: 'বিতরণ চলছে' },
    { en: 'No pending staff records under current view.', 'zh-CN': '当前视图下没有待审核的员工记录。', 'zh-TW': '當前視圖下沒有待審核的員工記錄。', ms: 'Tiada rekod kakitangan menunggu semakan dalam paparan semasa.', my: 'လက်ရှိမြင်ကွင်းတွင် စစ်ဆေးရန်ကျန်သော ဝန်ထမ်းမှတ်တမ်းမရှိပါ။', hi: 'वर्तमान दृश्य में कोई लंबित कर्मचारी रिकॉर्ड नहीं है।', bn: 'বর্তমান দৃশ্যে কোনো মুলতুবি স্টাফ রেকর্ড নেই।' },
    { en: 'Are you sure to batch approve ', 'zh-CN': '确定要一键核准', 'zh-TW': '確定要一鍵核准', ms: 'Pasti ingin mengesahkan secara pukal ', my: 'အစုလိုက်အတည်ပြုရန် သေချာပါသလား ', hi: 'क्या आप बल्क में स्वीकृत करना चाहते हैं ', bn: 'আপনি কি নিশ্চিত যে ব্যাচ অনুমোদন করতে চান ' },
    { en: 'currently filtered ', 'zh-CN': '当前筛选出的', 'zh-TW': '當前篩選出的', ms: 'yang ditapis ', my: 'လက်ရှိစစ်ထုတ်ထားသော ', hi: 'वर्तमान फ़िल्टर किए गए ', bn: 'বর্তমানে ফিল্টার করা ' },
    { en: ' employees clock-out hours?\nAttendance will be locked and archived.', 'zh-CN': '位员工下班工时吗？\n核准后将自动锁定考勤记录并归档。', 'zh-TW': '位員工下班工時嗎？\n核准後將自動鎖定考勤記錄並歸檔。', ms: ' staf tamat syif?\nRekod akan dikunci dan diarkibkan.', my: ' ဝန်ထမ်းများ၏ အလုပ်ဆင်းချိန်ကို အတည်ပြုမလား?\nအတည်ပြုပြီးပါက မှတ်တမ်းကို သော့ခတ်သိမ်းဆည်းပါမည်။', hi: ' कर्मचारियों के घंटे?\nउपस्थिति बंद और संग्रहीत की जाएगी।', bn: ' কর্মচারীদের কাজের সময়?\nরেকর্ড লক এবং সংরক্ষণাগারভুক্ত হবে।' },
    { en: 'Successfully batch approved', 'zh-CN': '成功批量核准', 'zh-TW': '成功批量核准', ms: 'Berjaya meluluskan secara pukal', my: 'အစုလိုက် အောင်မြင်စွာ အတည်ပြုပြီးပါပြီ', hi: 'सफलतापूर्वक बल्क स्वीकृत', bn: 'সফলভাবে ব্যাচ অনুমোদিত' },
    { en: ' shift records!', 'zh-CN': '条下班记录！', 'zh-TW': '條下班記錄！', ms: ' rekod syif!', my: ' ဆိုင်းမှတ်တမ်းများ!', hi: ' शिफ्ट रिकॉर्ड!', bn: ' শিফট রেকর্ড!' },
    { en: 'Error during batch approval, please refresh and retry.', 'zh-CN': '批量核准过程中出现问题，请刷新重试。', 'zh-TW': '批量核准過程中出現問題，請刷新重試。', ms: 'Ralat semasa kelulusan pukal, sila muat semula dan cuba lagi.', my: 'အစုလိုက်အတည်ပြုရာတွင် အမှားဖြစ်နေပါသည်၊ ကျေးဇူးပြု၍ ပြန်လည်စတင်ပါ။', hi: 'बल्क स्वीकृति के दौरान त्रुटि, कृपया रीफ़्रेश करें और पुनः प्रयास करें।', bn: 'ব্যাচ অনুমোদনের সময় সমস্যা হয়েছে, দয়া করে রিফ্রেশ করে আবার চেষ্টা করুন।' },
    { en: 'Are you sure to revert approval for staff ', 'zh-CN': '确定要撤销员工', 'zh-TW': '確定要撤銷員工', ms: 'Pasti mahu batalkan pengesahan staf ', my: 'ဝန်ထမ်း၏ အတည်ပြုချက်ကို ပြန်ဖျက်ရန် သေချာပါသလား ', hi: 'क्या आप कर्मचारी के लिए स्वीकृति वापस लेना चाहते हैं ', bn: 'আপনি কি নিশ্চিত কর্মীদের অনুমোদন প্রত্যাহার করতে চান ' },
    { en: '\'s approval?\nIt will return to Pending Review state.', 'zh-CN': '的工时核准标记吗？\n撤销后将回到待审核状态。', 'zh-TW': '的工時核准標記嗎？\n撤銷後將回到待審核狀態。', ms: '?\nIa akan kembali ke status Menunggu Semakan.', my: '? ပြန်ဖျက်ပြီးပါက စစ်ဆေးရန်ကျန် အခြေအနေသို့ ပြန်ရောက်ပါမည်။', hi: '? यह समीक्षा लंबित स्थिति में वापस आ जाएगा।', bn: '? এটি পর্যালোচনা মুলতুবি অবস্থায় ফিরে আসবে।' },
    { en: 'Approval update failed', 'zh-CN': '核准更新失败', 'zh-TW': '核准更新失敗', ms: 'Gagal mengemas kini kelulusan', my: 'အတည်ပြုချက် မအောင်မြင်ပါ', hi: 'स्वीकृति अद्यतन विफल', bn: 'অনুমোদন আপডেট ব্যর্থ হয়েছে' },
    { en: 'Save failed', 'zh-CN': '保存失败', 'zh-TW': '保存失敗', ms: 'Gagal menyimpan', my: 'သိမ်းဆည်းမှု မအောင်မြင်ပါ', hi: 'सहेजने में विफल', bn: 'সংরক্ষণ ব্যর্থ হয়েছে' },
    { en: '✅ Work hours record adjustment saved successfully!', 'zh-CN': '✅ 工时记录调整已成功保存！', 'zh-TW': '✅ 工時記錄調整已成功保存！', ms: '✅ Pelarasan rekod jam kerja berjaya disimpan!', my: '✅ အလုပ်ချိန်မှတ်တမ်းပြင်ဆင်မှု အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ!', hi: '✅ कार्य घंटे समायोजन सफलतापूर्वक सहेजा गया!', bn: '✅ কাজের সময়ের রেকর্ড সমন্বয় সফলভাবে সংরক্ষিত হয়েছে!' },
    { en: 'Warehouse', 'zh-CN': '仓库仓管', 'zh-TW': '倉庫倉管', ms: 'Pengurus Gudang', my: 'ဂိုဒေါင်ဝန်ထမ်း', hi: 'गोदाम कर्मचारी', bn: 'গুদাম কর্মী' },
    { en: 'Office', 'zh-CN': '行政/管理', 'zh-TW': '行政/管理', ms: 'Pentadbiran / Pejabat', my: 'ရုံး / စီမံခန့်ခွဲမှု', hi: 'प्रशासन / कार्यालय', bn: 'প্রশাসন / অফিস' },

    // 状态 Statuses
    { en: 'Active', 'zh-CN': '进行中 / 活跃', 'zh-TW': '進行中 / 活躍', ms: 'Aktif', my: 'လုပ်ဆောင်နေသည်', hi: 'सक्रिय', bn: 'সক্রিয়' },
    { en: 'Pending', 'zh-CN': '待处理', 'zh-TW': '待處理', ms: 'Menunggu', my: 'ဆိုင်းငံ့ထားသည်', hi: 'लंबित', bn: 'বিচারাধীন' },
    { en: 'Completed', 'zh-CN': '已完成', 'zh-TW': '已完成', ms: 'Selesai', my: 'ပြီးပါပြီ', hi: 'पूरा हुआ', bn: 'সম্পন্ন' },
    { en: 'Done', 'zh-CN': '完成', 'zh-TW': '完成', ms: 'Selesai', my: 'ပြီးပါပြီ', hi: 'हो गया', bn: 'সম্পন্ন' },
    { en: 'Draft', 'zh-CN': '草稿', 'zh-TW': '草稿', ms: 'Draf', my: 'မူကြမ်း', hi: 'प्रारूप', bn: 'খসड़ा' },
    { en: 'Approved', 'zh-CN': '已批准', 'zh-TW': '已批准', ms: 'Diluluskan', my: 'အတည်ပြုပြီး', hi: 'स्वीकृत', bn: 'অনুমোদিত' },
    { en: 'Rejected', 'zh-CN': '已驳回', 'zh-TW': '已駁回', ms: 'Ditolak', my: 'ပယ်ချခဲ့သည်', hi: 'अस्वीकृत', bn: 'প্রত্যাখ্যাত' },
    { en: 'Success', 'zh-CN': '操作成功', 'zh-TW': '操作成功', ms: 'Berjaya', my: 'အောင်မြင်သည်', hi: 'सफलता', bn: 'সফল' },
    { en: 'Failed', 'zh-CN': '操作失败', 'zh-TW': '操作失敗', ms: 'Gagal', my: 'မအောင်မြင်ပါ', hi: 'विफल', bn: 'ব্যর্থ' },

    // 框架与系统提示 Frame & System UI
    { en: 'Quit', 'zh-CN': '退出登录', 'zh-TW': '退出登入', ms: 'Log Keluar', my: 'ထွက်မည်', hi: 'लॉग आउट', bn: 'লগআউট' },
    { en: 'Device', 'zh-CN': '设备终端', 'zh-TW': '設備終端', ms: 'Peranti', my: 'စက်ပစ္စည်း', hi: 'उपकरण', bn: 'ডিভাইস' },
    { en: 'Expand sidebar', 'zh-CN': '展开侧栏', 'zh-TW': '展開側欄', ms: 'Kembangkan bar sisi', my: 'ဘေးဘားဖွင့်ပါ', hi: 'साइडबार विस्तृत करें', bn: 'সাইডবার প্রসারিত করুন' },
    { en: 'Collapse sidebar', 'zh-CN': '折叠侧栏', 'zh-TW': '摺疊側欄', ms: 'Runtuhkan bar sisi', my: 'ဘေးဘားခေါက်ပါ', hi: 'साइडबार संक्षिप्त करें', bn: 'সাইডবার সঙ্কুচিত করুন' },
    { en: 'PIN: ', 'zh-CN': '工号: ', 'zh-TW': '工號: ', ms: 'PIN: ', my: 'PIN: ', hi: 'पिन: ', bn: 'পিন: ' },
    { en: 'System v6.7 • Data Center Active', 'zh-CN': '系统 v6.7 • 数据中心运行中', 'zh-TW': '系統 v6.7 • 數據中心運行中', ms: 'Sistem v6.7 • Pusat Data Aktif', my: 'စနစ် v6.7 • ဒေတာစင်တာ အလုပ်လုပ်နေသည်', hi: 'सिस्टम v6.7 • डेटा सेंटर सक्रिय', bn: 'সিস্টেম v6.7 • ডেটা সেন্টার সক্রিয়' },
    { en: 'System Language / 系统语言', 'zh-CN': '系统语言', 'zh-TW': '系統語言', ms: 'Bahasa Sistem', my: 'စနစ်ဘာသာစကား', hi: 'सिस्टम भाषा', bn: 'সিস্টেম ভাষা' },
    { en: 'View My Profile / 个人主页', 'zh-CN': '查看个人主页', 'zh-TW': '查看個人主頁', ms: 'Lihat Profil', my: 'ပရိုဖိုင်ကြည့်ရှုပါ', hi: 'प्रोफाइल देखें', bn: 'প্রোফাইল দেখুন' },
    { en: '🤖 AI Assistant', 'zh-CN': '🤖 AI 智能助理', 'zh-TW': '🤖 AI 智能助理', ms: '🤖 Pembantu AI', my: '🤖 AI လက်ထောက်', hi: '🤖 एआई सहायक', bn: '🤖 এআই সহকারী' },
    { en: '💡 Page Logic Guide', 'zh-CN': '💡 本页逻辑说明', 'zh-TW': '💡 本頁邏輯說明', ms: '💡 Panduan Logik Halaman', my: '💡 စာမျက်နှာလမ်းညွှန်', hi: '💡 पृष्ठ तर्क गाइड', bn: '💡 পৃষ্ঠা যুক্তি গাইড' },
    { en: 'Select Language', 'zh-CN': '选择系统语言', 'zh-TW': '選擇系統語言', ms: 'Pilih Bahasa', my: 'ဘာသာစကားရွေးပါ', hi: 'भाषा चुनें', bn: 'ভাষা নির্বাচন করুন' },

    // 🚛 司机移动端常用词汇 (Driver Mobile Terminology - 三语/多语)
    { en: 'Confirm Delivery', 'zh-CN': '确认送达', 'zh-TW': '確認送達', ms: 'Sahkan Hantaran', my: 'ပို့ဆောင်မှုအတည်ပြုပါ', hi: 'वितरण की पुष्टि करें', bn: 'বিতরণ নিশ্চিত করুন' },
    { en: 'Load Items', 'zh-CN': '装车上货', 'zh-TW': '裝車上貨', ms: 'Naik Barang', my: 'ပစ္စည်းတင်ပါ', hi: 'सामान लोड करें', bn: 'পণ্য লোড করুন' },
    { en: 'Select Vehicle', 'zh-CN': '选择车辆', 'zh-TW': '選擇車輛', ms: 'Pilih Lori', my: 'ယာဉ်ရွေးချယ်ပါ', hi: 'वाहन चुनें', bn: 'যানবাহন নির্বাচন করুন' },
    { en: 'Request Service', 'zh-CN': '报修申请', 'zh-TW': '報修申請', ms: 'Mohon Servis', my: 'ပြုပြင်ခွင့်တောင်းပါ', hi: 'सेवा अनुरोध', bn: 'পরিষেবা অনুরোধ' },
    { en: 'Mileage (km)', 'zh-CN': '里程数 (公里)', 'zh-TW': '里程數 (公里)', ms: 'Bacaan ODO (km)', my: 'မိုင်နှုန်း (km)', hi: 'माइलेज (किमी)', bn: 'মাইলেজ (কিমি)' },
    { en: 'Retake Photo', 'zh-CN': '重新拍照', 'zh-TW': '重新拍照', ms: 'Ambil Semula', my: 'ပြန်ရိုက်ပါ', hi: 'दोबारा फोटो लें', bn: 'পুনরায় ছবি তুলুন' },
    { en: 'Confirm & Save', 'zh-CN': '确认并保存', 'zh-TW': '確認並儲存', ms: 'Sah & Simpan', my: 'အတည်ပြုပြီးသိမ်းပါ', hi: 'पुष्टि करें और सहेजें', bn: 'নিশ্চিত করুন এবং সংরক্ষণ করুন' },

    // 🏭 车间外籍工人与上下班打卡高频词汇 (Factory Worker & Clock-In Terminology - 六语极简大图标)
    { en: 'Clock In', 'zh-CN': '上班打卡', 'zh-TW': '上班打卡', ms: 'Daftar Masuk', my: 'အလုပ်စတင်ပါ (Clock In)', hi: 'काम शुरू (क्लॉक इन)', bn: 'কাজে প্রবেশ (Clock In)' },
    { en: 'Clock Out', 'zh-CN': '下班打卡', 'zh-TW': '下班打卡', ms: 'Daftar Keluar', my: 'အလုပ်ပြီးပါ (Clock Out)', hi: 'काम समाप्त (क्लॉक आउट)', bn: 'কাজ ত্যাগ (Clock Out)' },
    { en: 'Start Production', 'zh-CN': '开始生产', 'zh-TW': '開始生產', ms: 'Mula Pengeluaran', my: 'ထုတ်လုပ်မှုစတင်ပါ', hi: 'उत्पादन शुरू करें', bn: 'উৎপাদন শুরু করুন' },
    { en: 'Stop Production', 'zh-CN': '停止生产', 'zh-TW': '停止生產', ms: 'Henti Pengeluaran', my: 'ထုတ်လုပ်မှုရပ်ပါ', hi: 'उत्पादन रोकें', bn: 'উৎপাদন বন্ধ করুন' },
    { en: 'Scan QR Code', 'zh-CN': '扫描二维码', 'zh-TW': '掃描二維碼', ms: 'Imbas Kod QR', my: 'QR ကုဒ်စကင်န်ဖတ်ပါ', hi: 'क्यूआर कोड स्कैन करें', bn: 'কিউআর কোড স্ক্যান করুন' },
    { en: 'Take Photo', 'zh-CN': '现场拍照', 'zh-TW': '現場拍照', ms: 'Ambil Foto', my: 'ဓာတ်ပုံရိုက်ပါ', hi: 'फोटो लें', bn: 'ছবি তুলুন' },
    { en: 'Rolls Produced', 'zh-CN': '产出卷数', 'zh-TW': '產出卷數', ms: 'Bilangan Gulung', my: 'ထုတ်လုပ်ပြီးလိပ်များ', hi: 'उत्पादित रोल', bn: 'উৎপাদিত রোল' },
    { en: 'Single Layer', 'zh-CN': '单层气泡', 'zh-TW': '單層氣泡', ms: 'Lapisan Tunggal', my: 'တစ်လွှာ', hi: 'सिंगल लेयर', bn: 'একক স্তর' },
    { en: 'Double Layer', 'zh-CN': '双层气泡', 'zh-TW': '雙層氣泡', ms: 'Lapisan Ganda', my: 'နှစ်လွှာ', hi: 'डबल लेयर', bn: 'দ্বিগুণ স্তর' },
    { en: 'Machine Online', 'zh-CN': '机台运行中', 'zh-TW': '機台運行中', ms: 'Mesin Beroperasi', my: 'စက်လည်ပတ်နေသည်', hi: 'मशीन चालू है', bn: 'মেশিন চলছে' },
    { en: 'Machine Idle', 'zh-CN': '机台待机', 'zh-TW': '機台待機', ms: 'Mesin Melahu', my: 'စက်ရပ်နားထားသည်', hi: 'मशीन निष्क्रिय', bn: 'মেশিন নিষ্ক্রিয়' }
];

/**
 * 为指定语言生成核心词汇双向索引表：
 * 支持以英文或中文为 Key 查找对应语言的翻译
 */
function buildDictionaryForLanguage(lang: SupportedLanguage): Record<string, string> {
    const dict: Record<string, string> = {};

    CORE_TERMS.forEach(item => {
        const targetValue = item[lang] || item['en'];
        // 允许以英文作为 key
        dict[item.en] = targetValue;
        // 允许以驼峰/无空格英文作为 key（兼容 SuperAdmin, LogisticsCoordinator 等）
        dict[item.en.replace(/\s+/g, '')] = targetValue;
        // 允许以简体中文作为 key
        dict[item['zh-CN']] = targetValue;
        // 允许以繁体中文作为 key
        dict[item['zh-TW']] = targetValue;
    });

    return dict;
}

const resources = {
    'zh-CN': { translation: { ...zhCNJson, ...buildDictionaryForLanguage('zh-CN') } },
    'en': { translation: { ...enJson, ...buildDictionaryForLanguage('en') } },
    'ms': { translation: { ...msJson, ...buildDictionaryForLanguage('ms') } },
    'my': { translation: { ...myJson, ...buildDictionaryForLanguage('my') } },
    'zh-TW': { translation: { ...zhTWJson, ...buildDictionaryForLanguage('zh-TW') } },
    'hi': { translation: { ...hiJson, ...buildDictionaryForLanguage('hi') } },
    'bn': { translation: { ...bnJson, ...buildDictionaryForLanguage('bn') } }
};

const savedLang = (localStorage.getItem('packsecure_lang') as SupportedLanguage) || 'zh-CN';

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: savedLang,
        fallbackLng: savedLang.startsWith('zh') ? ['zh-CN', 'en'] : ['en', 'zh-CN'],
        interpolation: {
            escapeValue: false
        },
        react: {
            useSuspense: false
        }
    });

export const getCurrentLanguage = (): SupportedLanguage => {
    return (localStorage.getItem('packsecure_lang') as SupportedLanguage) || 'zh-CN';
};

export const t = (text: string, options?: Record<string, any>): string => {
    if (!text) return '';
    return i18n.t(text, { defaultValue: text, ...options });
};

export const changeLanguage = (langCode: SupportedLanguage) => {
    localStorage.setItem('packsecure_lang', langCode);
    i18n.changeLanguage(langCode);
    const event = new CustomEvent('packsecure:lang-change', { detail: langCode });
    window.dispatchEvent(event);
};

export default i18n;

