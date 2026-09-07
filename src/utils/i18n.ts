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
    { en: 'Machine Idle', 'zh-CN': '机台待机', 'zh-TW': '機台待機', ms: 'Mesin Melahu', my: 'စက်ရပ်နားထားသည်', hi: 'मशीन निष्क्रिय', bn: 'মেশিন নিষ্ক্রিয়' },

    // 📸 万能快拍 (Smart Intake) 7 语国际化核心词汇
    // 悬浮胶囊与入口 Floating Capsule & Entry
    { en: 'Smart Intake', 'zh-CN': '万能快拍', 'zh-TW': '萬能快拍', ms: 'Intake Pintar', my: 'စမတ်ရိုက်ကူးမှု', hi: 'स्मार्ट इनटेक', bn: 'স্মার্ট ইনটেক' },
    { en: 'Site Entry', 'zh-CN': '现场录入', 'zh-TW': '現場錄入', ms: 'Kemasukan Lapangan', my: 'လုပ်ငန်းခွင်ထည့်သွင်းခြင်း', hi: 'साइट प्रविष्टि', bn: 'সাইট এন্ট্রি' },
    { en: 'Pending Sync', 'zh-CN': '待同步', 'zh-TW': '待同步', ms: 'Menunggu Penyelarasan', my: 'ချိန်ကိုက်ရန်စောင့်နေသည်', hi: 'सिंक लंबित', bn: 'সিঙ্ক মুলতুবি' },
    { en: 'Click to sync offline pending queue', 'zh-CN': '点击同步离线暂存队列', 'zh-TW': '點擊同步離線暫存隊列', ms: 'Klik untuk selaraskan barisan luar talian', my: 'အော့ဖ်လိုင်းတန်းစီဇယားကို ချိန်ကိုက်ရန် နှိပ်ပါ', hi: 'ऑफ़लाइन कतार सिंक करने के लिए क्लिक करें', bn: 'অফলাইন সারি সিঙ্ক করতে ক্লিক করুন' },
    { en: 'Click to open Smart Intake & work entry', 'zh-CN': '点击打开万能快拍与作业录入', 'zh-TW': '點擊打開萬能快拍與作業錄入', ms: 'Klik untuk buka Intake Pintar & rekod kerja', my: 'စမတ်ရိုက်ကူးမှုနှင့် အလုပ်သွင်းရန် နှိပ်ပါ', hi: 'स्मार्ट इनटेक और कार्य प्रविष्टि खोलने के लिए क्लिक करें', bn: 'স্মার্ট ইনটেক এবং কাজ এন্ট্রি খুলতে ক্লিক করুন' },

    // 模态窗顶部与机台状态 Header & Machine Status
    { en: 'Smart Intake (Universal)', 'zh-CN': '万能快拍 (Smart Intake)', 'zh-TW': '萬能快拍 (Smart Intake)', ms: 'Intake Pintar (Smart Intake)', my: 'စမတ်ရိုက်ကူးမှု (Smart Intake)', hi: 'स्मार्ट इनटेक (Smart Intake)', bn: 'স্মার্ট ইনটেক (Smart Intake)' },
    { en: '0.8s Fast AI', 'zh-CN': '0.8s 极速识别', 'zh-TW': '0.8s 極速識別', ms: '0.8s AI Pantas', my: '၀.၈ စက္ကန့် အမြန်စစ်ဆေးခြင်း', hi: '0.8s त्वरित पहचान', bn: '০.৮ সেকেন্ড দ্রুত এআই' },
    { en: 'Just now', 'zh-CN': '刚刚', 'zh-TW': '剛剛', ms: 'Sebentar tadi', my: 'ခုနက', hi: 'अभी', bn: 'এইমাত্র' },
    { en: 'Locating...', 'zh-CN': '定位中...', 'zh-TW': '定位中...', ms: 'Mengesan lokasi...', my: 'တည်နေရာရှာနေသည်...', hi: 'स्थान खोज रहे हैं...', bn: 'অবস্থান খোঁজা হচ্ছে...' },
    { en: 'Current Machine:', 'zh-CN': '当前机台:', 'zh-TW': '當前機台:', ms: 'Mesin Semasa:', my: 'လက်ရှိစက်:', hi: 'वर्तमान मशीन:', bn: 'বর্তমান মেশিন:' },
    { en: 'No Machine Bound', 'zh-CN': '未绑定机台', 'zh-TW': '未綁定機台', ms: 'Tiada Mesin Terikat', my: 'စက်ချိတ်ဆက်မထားပါ', hi: 'कोई मशीन लिंक नहीं', bn: 'কোনো মেশিন লিঙ্ক নেই' },
    { en: 'Logging out...', 'zh-CN': '登出中...', 'zh-TW': '登出中...', ms: 'Sedang log keluar...', my: 'ထွက်နေသည်...', hi: 'लॉग आउट हो रहा है...', bn: 'লগ আউট হচ্ছে...' },
    { en: 'Quick Logout', 'zh-CN': '一键登出', 'zh-TW': '一鍵登出', ms: 'Log Keluar Segera', my: 'ချက်ချင်းထွက်မည်', hi: 'त्वरित लॉगआउट', bn: 'দ্রুত লগআউট' },
    { en: 'Scan Switch', 'zh-CN': '扫码换机', 'zh-TW': '掃碼換機', ms: 'Imbas Tukar Mesin', my: 'စက်ပြောင်းရန် စကင်န်ဖတ်ပါ', hi: 'मशीन बदलने के लिए स्कैन करें', bn: 'মেশিন পরিবর্তন করতে স্ক্যান করুন' },
    { en: 'Scan Login Machine', 'zh-CN': '扫码登录机台', 'zh-TW': '掃碼登錄機台', ms: 'Imbas Masuk Mesin', my: 'စက်သို့ဝင်ရောက်ရန် စကင်န်ဖတ်ပါ', hi: 'मशीन लॉगिन के लिए स्कैन करें', bn: 'মেশিনে লগইন করতে স্ক্যান করুন' },
    { en: 'Unbind current machine and clock out', 'zh-CN': '一键解绑当前机台并记录下线考勤', 'zh-TW': '一鍵解綁當前機台並記錄下線考勤', ms: 'Nyahikat mesin semasa & rekod jam keluar', my: 'လက်ရှိစက်ချိတ်ဆက်မှုဖြုတ်ပြီး အလုပ်ဆင်းမှတ်တမ်းတင်ပါ', hi: 'वर्तमान मशीन अनबाउंड करें और क्लॉक आउट रिकॉर्ड करें', bn: 'বর্তমান মেশিন আনবাউন্ড করুন এবং ক্লক আউট রেকর্ড করুন' },
    { en: 'On-site rule: Must scan machine QR code to switch machine', 'zh-CN': '现场规则：切换机台必须对准机台二维码进行扫码', 'zh-TW': '現場規則：切換機台必須對準機台二維碼進行掃碼', ms: 'Peraturan tapak: Mesti imbas kod QR mesin untuk tukar mesin', my: 'စည်းမျဉ်း: စက်ပြောင်းရန် စက်၏ QR ကုဒ်ကို စကင်န်ဖတ်ရပါမည်', hi: 'साइट नियम: मशीन बदलने के लिए मशीन क्यूआर कोड स्कैन करना अनिवार्य है', bn: 'সাইট নিয়ম: মেশিন পরিবর্তন করতে মেশিনের কিউআর কোড স্ক্যান করতে হবে' },

    // 扫码取景器 QR Scanner
    { en: 'Must Scan QR to Switch Machine', 'zh-CN': '切换机台一定要扫码', 'zh-TW': '切換機台一定要掃碼', ms: 'Wajib Imbas QR Untuk Tukar Mesin', my: 'စက်ပြောင်းရန် QR စကင်န်ဖတ်ရပါမည်', hi: 'मशीन बदलने के लिए क्यूआर स्कैन अनिवार्य है', bn: 'মেশিন পরিবর্তনের জন্য কিউআর স্ক্যান বাধ্যতামূলক' },
    { en: 'Aim camera at machine nameplate or QR label (e.g. T1-1, N1-1)', 'zh-CN': '请将摄像头对准机身铭牌或二维码标签 (如 T1-1, N1-1 等)', 'zh-TW': '請將攝像頭對準機身銘牌或二維碼標籤 (如 T1-1, N1-1 等)', ms: 'Halakan kamera ke plat mesin atau label QR (cth: T1-1, N1-1)', my: 'ကင်မရာကို စက်အညွှန်း သို့မဟုတ် QR ကုဒ်သို့ ချိန်ပါ (ဥပမာ T1-1, N1-1)', hi: 'कैमरा मशीन नेमप्लेट या क्यूआर लेबल पर रखें (उदा: T1-1, N1-1)', bn: 'ক্যামেরাটি মেশিনের নেমপ্লেট বা কিউআর লেবেলে তাক করুন (যেমন T1-1, N1-1)' },

    // 相机与专项作业引导 Camera & Special Work
    { en: 'Tap to Take Photo', 'zh-CN': '点击调用相机拍照', 'zh-TW': '點擊調用相機拍照', ms: 'Ketik Untuk Ambil Foto', my: 'ဓာတ်ပုံရိုက်ရန် နှိပ်ပါ', hi: 'फ़ोटो लेने के लिए टैप करें', bn: 'ছবি তুলতে ট্যাপ করুন' },
    { en: 'Recommended', 'zh-CN': '首选推荐', 'zh-TW': '首選推薦', ms: 'Disyorkan', my: 'အကြံပြုထားသည်', hi: 'अनुशंसित', bn: 'সুপারিশকৃত' },
    { en: 'Supports scales, scrap/defects, machine plates, DO, and mixing recipe', 'zh-CN': '支持称重磅秤、废料次品、机台铭牌、送货单、配方投料', 'zh-TW': '支持稱重磅秤、廢料次品、機台銘牌、送貨單、配方投料', ms: 'Menyokong penimbang, sisa/rosak, plat mesin, DO, dan ramuan', my: 'ချိန်ခွင်၊ စွန့်ပစ်ပစ္စည်း၊ စက်အညွှန်း၊ ပို့ဆောင်လွှာနှင့် ရောစပ်နည်းများကို ထောက်ပံ့သည်', hi: 'तराजू, स्क्रैप/खराब माल, मशीन प्लेट, डीओ और सामग्री का समर्थन करता है', bn: 'স্কেল, স্ক্র্যাপ/ত্রুটিপূর্ণ পণ্য, মেশিন প্লেট, ডিও এবং উপাদান সমর্থন করে' },
    { en: 'Operator 6 Special Work Categories', 'zh-CN': '操作员 6 大专项作业快捷分类', 'zh-TW': '操作員 6 大專項作業快捷分類', ms: '6 Kategori Kerja Khas Operator', my: 'အော်ပရေတာ အထူးလုပ်ငန်း ၆ မျိုး', hi: 'ऑपरेटर 6 विशेष कार्य श्रेणियां', bn: 'অপারেটর ৬টি বিশেষ কাজের বিভাগ' },
    { en: 'Select category then write notes or take photo', 'zh-CN': '点选分类后可写字或拍照', 'zh-TW': '點選分類後可寫字或拍照', ms: 'Pilih kategori kemudian catat atau ambil foto', my: 'အမျိုးအစားရွေးပြီး စာရေးပါ သို့မဟုတ် ဓာတ်ပုံရိုက်ပါ', hi: 'श्रेणी चुनें फिर नोट लिखें या फ़ोटो लें', bn: 'বিভাগ নির্বাচন করুন তারপর নোট লিখুন বা ছবি তুলুন' },

    // 6 大专项分类名称与描述 Special Work Categories & Descs
    { en: 'Container Intake', 'zh-CN': 'Container 原料采购', 'zh-TW': 'Container 原料採購', ms: 'Kemasukan Kontena', my: 'ကွန်တိန်နာ ကုန်ကြမ်း', hi: 'कंटेनर कच्चा माल', bn: 'কনটেইনার কাঁচামাল' },
    { en: 'Resin/material unload', 'zh-CN': '树脂/物料到厂卸柜', 'zh-TW': '樹脂/物料到廠卸櫃', ms: 'Bongkar damar / bahan', my: 'ကုန်ကြမ်းပစ္စည်း ချခြင်း', hi: 'राल / सामग्री उतारना', bn: 'রজন / উপাদান খালাস' },
    { en: 'OT Workshop Overtime', 'zh-CN': 'OT 车间加班', 'zh-TW': 'OT 車間加班', ms: 'OT Kerja Lebih Masa', my: 'OT အလုပ်ပိုအချိန်', hi: 'ओटी कार्यशाला ओवरटाइम', bn: 'ওটি কর্মশালা ওভারটাইম' },
    { en: 'Mesh change/rush order/maintenance', 'zh-CN': '换网/赶单/检修', 'zh-TW': '換網/趕單/檢修', ms: 'Tukar jaring / tempahan kecemasan / servis', my: 'ပိုက်လဲခြင်း / အရေးပေါ်အော်ဒါ / ပြုပြင်ခြင်း', hi: 'जाली बदलना / तत्काल ऑर्डर / मरम्मत', bn: 'জাল পরিবর্তন / জরুরি অর্ডার / মেরামত' },
    { en: 'Trip Assistance', 'zh-CN': '协助行程 Trip', 'zh-TW': '協助行程 Trip', ms: 'Bantuan Perjalanan Trip', my: 'ခရီးစဉ်အကူအညီ Trip', hi: 'यात्रा सहायता ट्रिप', bn: 'ভ্রমণ সহায়তা ট্রিপ' },
    { en: 'Assist driver load goods', 'zh-CN': '协助司机配货装车', 'zh-TW': '協助司機配貨裝車', ms: 'Bantu pemandu susun & muat barang', my: 'ယာဉ်မောင်းအား ပစ္စည်းတင်ရန်ကူညီခြင်း', hi: 'ड्राइवर को सामान लोड करने में मदद करें', bn: 'ড্রাইভারকে পণ্য লোড করতে সহায়তা করুন' },
    { en: 'Handling (Unload & Pallet)', 'zh-CN': '搬运 (卸柜打托)', 'zh-TW': '搬運 (卸櫃打托)', ms: 'Pemunggahan (Palet)', my: 'သယ်ယူပို့ဆောင်ခြင်း (ပက်လက်စီခြင်း)', hi: 'हैंडलिंग (उतारना और पैलेट)', bn: 'হ্যান্ডলিং (আনলোড এবং প্যালেট)' },
    { en: 'Unload goods & palletize', 'zh-CN': '到货卸柜搬运码托', 'zh-TW': '到貨卸櫃搬運碼托', ms: 'Bongkar barang & susun palet', my: 'ပစ္စည်းချပြီး ပက်လက်စီခြင်း', hi: 'सामान उतारना और पैलेट बनाना', bn: 'পণ্য খালাস এবং প্যালেটাইজ' },
    { en: 'Shopee Parcel', 'zh-CN': 'Shopee 散单', 'zh-TW': 'Shopee 散單', ms: 'Bungkusan Shopee', my: 'Shopee ပါဆယ်', hi: 'शॉपी पार्सल', bn: 'শপি পার্সেল' },
    { en: 'E-commerce pack & label', 'zh-CN': '电商小包打包贴单', 'zh-TW': '電商小包打包貼單', ms: 'Bungkus & lekat label e-dagang', my: 'အွန်လိုင်းပါဆယ်ထုပ်ပိုးခြင်း', hi: 'ई-कॉमर्स पैक और लेबल', bn: 'ই-কমার্স প্যাক এবং লেবেল' },
    { en: 'Boss Special Order', 'zh-CN': 'Boss 特单', 'zh-TW': 'Boss 特單', ms: 'Pesanan Khas Boss', my: 'Boss အထူးအော်ဒါ', hi: 'बॉस विशेष ऑर्डर', bn: 'বস বিশেষ অর্ডার' },
    { en: 'Urgent order approved by Boss', 'zh-CN': '老板交代加急特批', 'zh-TW': '老闆交代加急特批', ms: 'Pesanan segera kelulusan Boss', my: 'Boss မှ အထူးခွင့်ပြုထားသော အရေးပေါ်အော်ဒါ', hi: 'बॉस द्वारा तत्काल स्वीकृत विशेष कार्य', bn: 'বস কর্তৃক অনুমোদিত জরুরি বিশেষ অর্ডার' },

    // 文字/语音快速输入 Quick Text / Voice
    { en: 'Quick Text / Voice Input (Send to upload directly)', 'zh-CN': '文字 / 语音快速输入 (写完点发送直接上传)', 'zh-TW': '文字 / 語音快速輸入 (寫完點發送直接上傳)', ms: 'Input Teks / Suara Pantas (Ketik hantar untuk terus muat naik)', my: 'စာသား / အသံ အမြန်ထည့်သွင်းခြင်း (တိုက်ရိုက်ပေးပို့နိုင်သည်)', hi: 'त्वरित टेक्स्ट / वॉयस इनपुट (भेजने पर तुरंत अपलोड करें)', bn: 'দ্রুত টেক্সট / ভয়েস ইনপুট (পাঠাতে চাপলে সরাসরি আপলোড)' },
    { en: 'Listening...', 'zh-CN': '正在倾听...', 'zh-TW': '正在傾聽...', ms: 'Mendengar...', my: 'နားထောင်နေသည်...', hi: 'सुन रहे हैं...', bn: 'শুনছি...' },
    { en: 'Tap to Speak', 'zh-CN': '按此说话', 'zh-TW': '按此說話', ms: 'Ketik Untuk Cakap', my: 'စကားပြောရန် နှိပ်ပါ', hi: 'बोलने के लिए टैप करें', bn: 'বলতে ট্যাপ করুন' },
    { en: 'Enter text, e.g.: Machine 3 weigh 18.5kg, OT 2 hrs, unload 20 pallets...', 'zh-CN': '输入文字，如：3号机称重 18.5kg、OT加班2小时、卸柜20托...', 'zh-TW': '輸入文字，如：3號機稱重 18.5kg、OT加班2小時、卸櫃20托...', ms: 'Masukkan teks, cth: Mesin 3 timbang 18.5kg, OT 2 jam, bongkar 20 palet...', my: 'စာရိုက်ပါ၊ ဥပမာ- စက် ၃ ချိန်တွယ် ၁၈.၅ ကီလို၊ OT ၂ နာရီ၊ ပက်လက် ၂၀ ချ...', hi: 'टेक्स्ट दर्ज करें, उदा: मशीन 3 वजन 18.5kg, ओटी 2 घंटे, 20 पैलेट उतारना...', bn: 'টেক্সট লিখুন, যেমন: মেশিন ৩ ওজন ১৮.৫ কেজি, ওটি ২ ঘণ্টা, ২০ প্যালেট খালাস...' },
    { en: 'Send AI', 'zh-CN': '发送识别', 'zh-TW': '發送識別', ms: 'Hantar AI', my: 'ခွဲခြမ်းစိတ်ဖြာရန် ပို့ပါ', hi: 'पहचान के लिए भेजें', bn: 'শনাক্তকরণে পাঠান' },
    { en: 'Submit text to parse and commit', 'zh-CN': '提交文字智能识别并入库', 'zh-TW': '提交文字智能識別並入庫', ms: 'Hantar teks untuk pengecaman & simpan', my: 'စာသားကို စစ်ဆေးသိမ်းဆည်းရန် တင်သွင်းပါ', hi: 'पहचान और इनटेक के लिए टेक्स्ट सबमिट करें', bn: 'শনাক্ত এবং জমা দিতে টেক্সট পাঠান' },
    { en: 'Quick Presets:', 'zh-CN': '快捷输入:', 'zh-TW': '快捷輸入:', ms: 'Pilihan Pantas:', my: 'အမြန်ရွေးချယ်မှု:', hi: 'त्वरित इनपुट:', bn: 'দ্রুত প্রিসেট:' },

    // 快捷输入词条 Preset Buttons
    { en: 'Logout Current Machine', 'zh-CN': '登出当前机台', 'zh-TW': '登出當前機台', ms: 'Log Keluar Mesin Semasa', my: 'လက်ရှိစက်မှ ထွက်မည်', hi: 'वर्तमान मशीन से लॉग आउट करें', bn: 'বর্তমান মেশিন থেকে লগ আউট করুন' },
    { en: 'M3 Weigh 18.5kg', 'zh-CN': '3号机称重 18.5kg', 'zh-TW': '3號機稱重 18.5kg', ms: 'M3 Timbang 18.5kg', my: 'စက် ၃ ချိန်တွယ် ၁၈.၅kg', hi: 'एम3 वजन 18.5kg', bn: 'এম৩ ওজন ১৮.৫ কেজি' },
    { en: 'OT Overtime 2.0 hrs', 'zh-CN': 'OT加班 2.0小时', 'zh-TW': 'OT加班 2.0小時', ms: 'OT Lebih Masa 2.0 jam', my: 'OT အချိန်ပို ၂.၀ နာရီ', hi: 'ओटी ओवरटाइम 2.0 घंटे', bn: 'ওটি ওভারটাইম ২.০ ঘণ্টা' },
    { en: 'Raw Material Unload 20 Pallets', 'zh-CN': '原料卸柜 20托', 'zh-TW': '原料卸櫃 20托', ms: 'Bongkar Bahan 20 Palet', my: 'ကုန်ကြမ်းပက်လက် ၂၀ ချ', hi: 'कच्चा माल 20 पैलेट उतारना', bn: 'কাঁচামাল খালাস ২০ প্যালেট' },
    { en: 'Assist Delivery TRIP-01', 'zh-CN': '协助送货行程 TRIP-01', 'zh-TW': '協助送貨行程 TRIP-01', ms: 'Bantu Penghantaran TRIP-01', my: 'ပို့ဆောင်ရေး အကူအညီ TRIP-01', hi: 'वितरण यात्रा सहायता TRIP-01', bn: 'ডেলিভারি সহায়তা TRIP-01' },
    { en: 'Shopee Pack 5 pkgs', 'zh-CN': 'Shopee 打包 5件', 'zh-TW': 'Shopee 打包 5件', ms: 'Shopee Bungkus 5 bungkusan', my: 'Shopee ၅ ထုပ် ထုပ်ပိုး', hi: 'शॉपी 5 पैकेट पैक', bn: 'শপি ৫ প্যাকেট প্যাক' },
    { en: 'M5 Cutter Overheated Stopped', 'zh-CN': '5号机切刀过热停机', 'zh-TW': '5號機切刀過熱停機', ms: 'Pemotong M5 Panas Berhenti', my: 'စက် ၅ ဓားအပူလွန်ကဲ၍ ရပ်တန့်', hi: 'एम5 कटर अधिक गर्म होकर बंद', bn: 'এম৫ কাটার অতিরিক্ত গরম হয়ে বন্ধ' },

    // 预览与 AI 识别 Analysis & Preview
    { en: 'Retake', 'zh-CN': '重拍', 'zh-TW': '重拍', ms: 'Ambil Semula', my: 'ပြန်ရိုက်ပါ', hi: 'दोबारा लें', bn: 'পুনরায় তুলুন' },
    { en: 'Submitted Text/Voice Entry:', 'zh-CN': '已提交文字/语音录入:', 'zh-TW': '已提交文字/語音錄入:', ms: 'Entri Teks/Suara Diserahkan:', my: 'ပေးပို့ထားသော စာသား/အသံ:', hi: 'प्रस्तुत टेक्स्ट/वॉयस प्रविष्टि:', bn: 'জমা দেওয়া টেক্সট/ভয়েস এন্ট্রি:' },
    { en: 'No notes', 'zh-CN': '无文字备注', 'zh-TW': '無文字備註', ms: 'Tiada catatan', my: 'မှတ်စုမရှိပါ', hi: 'कोई नोट नहीं', bn: 'কোনো নোট নেই' },
    { en: 'Re-enter', 'zh-CN': '重新输入', 'zh-TW': '重新輸入', ms: 'Masukkan Semula', my: 'ပြန်ထည့်ပါ', hi: 'पुनः दर्ज करें', bn: 'পুনরায় লিখুন' },
    { en: 'Gemini AI Fast Analyzing...', 'zh-CN': 'Gemini 极速分析识别中...', 'zh-TW': 'Gemini 極速分析識別中...', ms: 'Gemini AI Menganalisis Pantas...', my: 'Gemini AI အမြန်ခွဲခြမ်းစိတ်ဖြာနေသည်...', hi: 'जेमिनी एआई त्वरित विश्लेषण कर रहा है...', bn: 'জেমিনি এআই দ্রুত বিশ্লেষণ করছে...' },
    { en: 'Extracting business intent, metrics and category', 'zh-CN': '正在提取业务意图、关键数字与归属分类', 'zh-TW': '正在提取業務意圖、關鍵數字與歸屬分類', ms: 'Mengekstrak niat perniagaan, metrik & kategori', my: 'လုပ်ငန်းရည်ရွယ်ချက်၊ ကိန်းဂဏန်းများနှင့် အမျိုးအစားများကို ထုတ်ယူနေသည်', hi: 'व्यावसायिक उद्देश्य, मुख्य आंकड़े और श्रेणी निकाली जा रही है', bn: 'ব্যবসায়িক উদ্দেশ্য, মূল সংখ্যা এবং বিভাগ বের করা হচ্ছে' },

    // 业务意图分类 Intents
    { en: 'Production Weight', 'zh-CN': '生产报工称重', 'zh-TW': '生產報工稱重', ms: 'Timbang Pengeluaran', my: 'ထုတ်လုပ်မှု အလေးချိန်', hi: 'उत्पादन वजन', bn: 'উৎপাদন ওজন' },
    { en: 'Defect & Scrap', 'zh-CN': '废料次品报废', 'zh-TW': '廢料次品報廢', ms: 'Sisa & Rosak', my: 'စွန့်ပစ်နှင့် အပြစ်အနာအဆာ', hi: 'स्क्रैप और खराब माल', bn: 'স্ক্র্যাপ এবং ত্রুটি' },
    { en: 'Machine Anomaly', 'zh-CN': '设备异常与点检', 'zh-TW': '設備異常與點檢', ms: 'Anomali & Servis Mesin', my: 'စက်ချို့ယွင်းချက်နှင့် စစ်ဆေးခြင်း', hi: 'मशीन असामान्यता और निरीक्षण', bn: 'মেশিন অসঙ্গতি এবং পরিদর্শন' },
    { en: 'Delivery POD', 'zh-CN': '物流送货签收 (POD)', 'zh-TW': '物流送貨簽收 (POD)', ms: 'Pengesahan Hantaran (POD)', my: 'ပို့ဆောင်မှု လက်ခံလွှာ (POD)', hi: 'वितरण पावती (POD)', bn: 'ডেলিভারি প্রাপ্তি (POD)' },
    { en: 'Patrol & Attendance', 'zh-CN': '现场巡查与考勤', 'zh-TW': '現場巡查與考勤', ms: 'Rondaan & Kehadiran', my: 'စစ်ဆေးရေးနှင့် တက်ရောက်မှု', hi: 'गश्त और उपस्थिति', bn: 'টহল এবং উপস্থিতি' },
    { en: 'Raw Material Recipe', 'zh-CN': '原料配方与投料', 'zh-TW': '原料配方與投料', ms: 'Resipi & Suapan Bahan', my: 'ကုန်ကြမ်းဖော်မြူလာနှင့် ထည့်သွင်းခြင်း', hi: 'कच्चा माल फॉर्मूला और फीडिंग', bn: 'কাঁচামাল ফর্মুলা এবং ফিডিং' },
    { en: 'Operator Special Work', 'zh-CN': '操作员专项作业', 'zh-TW': '操作員專項作業', ms: 'Kerja Khas Operator', my: 'အော်ပရေတာ အထူးလုပ်ငန်း', hi: 'ऑपरेटर विशेष कार्य', bn: 'অপারেটর বিশেষ কাজ' },
    { en: 'Machine Login & Bind', 'zh-CN': '机台登录与绑定', 'zh-TW': '機台登錄與綁定', ms: 'Log Masuk & Paut Mesin', my: 'စက်ဝင်ရောက်ခြင်းနှင့် ချိတ်ဆက်ခြင်း', hi: 'मशीन लॉगिन और बाइंडिंग', bn: 'মেশিন লগইন এবং বাইন্ড' },
    { en: 'Analyzing...', 'zh-CN': '智能分析中', 'zh-TW': '智能分析中', ms: 'Menganalisis...', my: 'ခွဲခြမ်းစိတ်ဖြာနေသည်...', hi: 'विश्लेषण जारी है...', bn: 'বিশ্লেষণ চলছে...' },

    // 字段与卡片 Fields & Cards
    { en: 'Special:', 'zh-CN': '专项:', 'zh-TW': '專項:', ms: 'Khas:', my: 'အထူး:', hi: 'विशेष:', bn: 'বিশেষ:' },
    { en: 'Detected Machine:', 'zh-CN': '识别到机台:', 'zh-TW': '識別到機台:', ms: 'Mesin Dikesan:', my: 'တွေ့ရှိသောစက်:', hi: 'पहचानी गई मशीन:', bn: 'শনাক্ত করা মেশিন:' },
    { en: 'Currently bound as ', 'zh-CN': '当前绑定为 ', 'zh-TW': '當前綁定為 ', ms: 'Kini terikat sebagai ', my: 'လက်ရှိချိတ်ဆက်မှုမှာ ', hi: 'वर्तमान बाइंडिंग ', bn: 'বর্তমানে আবদ্ধ ' },
    { en: ', login to this machine?', 'zh-CN': '，是否登录此机台？', 'zh-TW': '，是否登錄此機台？', ms: ', log masuk ke mesin ini?', my: '၊ ဤစက်သို့ ဝင်ရောက်မလား?', hi: ', क्या इस मशीन में लॉगिन करें?', bn: ', এই মেশিনে লগইন করবেন?' },
    { en: 'Login & Bind Now', 'zh-CN': '立即登录绑定', 'zh-TW': '立即登錄綁定', ms: 'Log Masuk Sekarang', my: 'ယခုပင် ချိတ်ဆက်ပါ', hi: 'अभी लॉगिन और बाइंड करें', bn: 'এখনই লগইন ও লিঙ্ক করুন' },
    { en: 'AI Analysis Result', 'zh-CN': 'AI 识别结论', 'zh-TW': 'AI 識別結論', ms: 'Hasil Analisis AI', my: 'AI စစ်ဆေးတွေ့ရှိချက်', hi: 'एआई पहचान निष्कर्ष', bn: 'এআই বিশ্লেষণ ফলাফল' },
    { en: 'Confidence:', 'zh-CN': '置信度:', 'zh-TW': '置信度:', ms: 'Keyakinan:', my: 'ယုံကြည်စိတ်ချရမှု:', hi: 'विश्वसनीयता:', bn: 'নির্ভরযোগ্যতা:' },
    { en: 'Measured Weight (kg)', 'zh-CN': '实测重量 (kg)', 'zh-TW': '實測重量 (kg)', ms: 'Berat Diukur (kg)', my: 'အလေးချိန် (kg)', hi: 'मापा गया वजन (kg)', bn: 'পরিমাপকৃত ওজন (কেজি)' },
    { en: 'Linked Machine (Scan to Bind)', 'zh-CN': '关联机台 (扫码绑定)', 'zh-TW': '關聯機台 (掃碼綁定)', ms: 'Mesin Berkaitan (Imbas Paut)', my: 'ချိတ်ဆက်ထားသောစက် (စကင်န်ဖတ်ချိတ်ဆက်ပါ)', hi: 'संबंधित मशीन (स्कैन कर बाइंड करें)', bn: 'সংযুক্ত মেশিন (স্ক্যান করে লিঙ্ক করুন)' },
    { en: 'Unscanned Machine', 'zh-CN': '未扫码机台', 'zh-TW': '未掃碼機台', ms: 'Mesin Belum Diimbas', my: 'စကင်န်မဖတ်ရသေးသောစက်', hi: 'बिना स्कैन की गई मशीन', bn: 'স্ক্যান না করা মেশিন' },
    { en: 'On-site rule: Must scan QR code to switch machine', 'zh-CN': '现场规则：切换机台必须扫码', 'zh-TW': '現場規則：切換機台必須掃碼', ms: 'Peraturan tapak: Mesti imbas QR untuk tukar mesin', my: 'စည်းမျဉ်း: စက်ပြောင်းရန် QR စကင်န်ဖတ်ရပါမည်', hi: 'साइट नियम: मशीन बदलने के लिए क्यूआर स्कैन आवश्यक', bn: 'সাইট নিয়ম: মেশিন পরিবর্তনের জন্য কিউআর স্ক্যান প্রয়োজন' },
    { en: 'DO Number', 'zh-CN': '送货单号 (DO Number)', 'zh-TW': '送貨單號 (DO Number)', ms: 'Nombor DO', my: 'ပို့ဆောင်လွှာအမှတ် (DO Number)', hi: 'डीओ नंबर (DO Number)', bn: 'ডিও নম্বর (DO Number)' },
    { en: 'e.g.: DO-8821', 'zh-CN': '例: DO-8821', 'zh-TW': '例: DO-8821', ms: 'Cth: DO-8821', my: 'ဥပမာ: DO-8821', hi: 'उदा: DO-8821', bn: 'যেমন: DO-8821' },
    { en: 'Defect / Anomaly Category', 'zh-CN': '异常/原因分类', 'zh-TW': '異常/原因分類', ms: 'Kategori Anomali / Sebab', my: 'ချို့ယွင်းချက် / အကြောင်းရင်း', hi: 'असामान्यता / कारण श्रेणी', bn: 'অসঙ্গতি / কারণ বিভাগ' },
    { en: 'e.g.: Bubble film too thick / mesh change stoppage', 'zh-CN': '例如: 膜卷气泡过厚 / 换网停机', 'zh-TW': '例如: 膜卷氣泡過厚 / 換網停機', ms: 'Cth: Filem gelembung tebal / henti tukar jaring', my: 'ဥပမာ: ပူဖောင်းဖလင်ထူလွန်းသည် / ပိုက်လဲရပ်နား', hi: 'उदा: बबल फिल्म बहुत मोटी / जाली बदलने के लिए बंद', bn: 'যেমন: বাবল ফিল্ম খুব পুরু / জাল পরিবর্তনের জন্য বন্ধ' },
    { en: 'Machine Scan Login Confirmation (Scan QR on machine body)', 'zh-CN': '机台扫码登录确认 (切换机台需对准机身二维码)', 'zh-TW': '機台掃碼登錄確認 (切換機台需對準機身二維碼)', ms: 'Pengesahan Log Masuk Mesin (Imbas QR pada mesin)', my: 'စက်ဝင်ရောက်ခြင်း အတည်ပြုချက် (စက်ပေါ်ရှိ QR ကို စကင်န်ဖတ်ပါ)', hi: 'मशीन लॉगिन पुष्टि (मशीन पर क्यूआर स्कैन करें)', bn: 'মেশিন লগইন নিশ্চিতকরণ (মেশিনের কিউআর স্ক্যান করুন)' },
    { en: 'Machine to Bind', 'zh-CN': '待绑定机台', 'zh-TW': '待綁定機台', ms: 'Mesin Untuk Dipaut', my: 'ချိတ်ဆက်မည့်စက်', hi: 'बाइंड की जाने वाली मशीन', bn: 'লিঙ্ক করার জন্য মেশিন' },
    { en: 'Rescan', 'zh-CN': '重新扫码', 'zh-TW': '重新掃碼', ms: 'Imbas Semula', my: 'ပြန်လည်စကင်န်ဖတ်ပါ', hi: 'पुनः स्कैन करें', bn: 'পুনরায় স্ক্যান করুন' },
    { en: 'Bind Now', 'zh-CN': '立即绑定', 'zh-TW': '立即綁定', ms: 'Paut Sekarang', my: 'ယခုချိတ်ပါ', hi: 'अभी बाइंड करें', bn: 'এখনই লিঙ্ক করুন' },

    // 专项作业表单字段 Special Work Form Fields
    { en: 'Container No', 'zh-CN': '货柜柜号 (Container No)', 'zh-TW': '貨櫃櫃號 (Container No)', ms: 'No Kontena', my: 'ကွန်တိန်နာနံပါတ်', hi: 'कंटेनर संख्या', bn: 'কনটেইনার নম্বর' },
    { en: 'e.g.: MSCU-882910', 'zh-CN': '例: MSCU-882910', 'zh-TW': '例: MSCU-882910', ms: 'Cth: MSCU-882910', my: 'ဥပမာ: MSCU-882910', hi: 'उदा: MSCU-882910', bn: 'যেমন: MSCU-882910' },
    { en: 'Seal No', 'zh-CN': '铅封号 (Seal No)', 'zh-TW': '鉛封號 (Seal No)', ms: 'No Mohor (Seal)', my: 'တံဆိပ်ခတ်နံပါတ် (Seal No)', hi: 'सील नंबर', bn: 'সিল নম্বর' },
    { en: 'e.g.: SL-123456', 'zh-CN': '例: SL-123456', 'zh-TW': '例: SL-123456', ms: 'Cth: SL-123456', my: 'ဥပမာ: SL-123456', hi: 'उदा: SL-123456', bn: 'যেমন: SL-123456' },
    { en: 'Material Category', 'zh-CN': '采购物料类别', 'zh-TW': '採購物料類別', ms: 'Kategori Bahan Dibeli', my: 'ဝယ်ယူသောကုန်ကြမ်းအမျိုးအစား', hi: 'कच्चा माल श्रेणी', bn: 'কাঁচামাল বিভাগ' },
    { en: 'e.g.: Polyethylene resin / masterbatch', 'zh-CN': '例: 聚乙烯树脂 / 色母', 'zh-TW': '例: 聚乙烯樹脂 / 色母', ms: 'Cth: Damar polietilena / masterbatch', my: 'ဥပမာ: ပိုလီအီသလင်း ကုန်ကြမ်း / မာစတာဘတ်ခ်ျ', hi: 'उदा: पॉलीथीन राल / मास्टरबैच', bn: 'যেমন: পলিথিন রজন / মাস্টারব্যাচ' },
    { en: 'Unloaded Pallets / Pcs', 'zh-CN': '卸柜件数 / 托数', 'zh-TW': '卸櫃件數 / 托數', ms: 'Jumlah Palet / Bungkusan', my: 'ချထားသော ပက်လက် / အရေအတွက်', hi: 'उतारे गए पैलेट / टुकड़े', bn: 'খালাস করা প্যালেট / টুকরা' },
    { en: 'e.g.: 20 Pallets', 'zh-CN': '例: 20 托', 'zh-TW': '例: 20 托', ms: 'Cth: 20 Palet', my: 'ဥပမာ: ၂၀ ပက်လက်', hi: 'उदा: 20 पैलेट', bn: 'যেমন: ২০ প্যালেট' },
    { en: 'OT Hours (hrs)', 'zh-CN': '加班工时 (小时)', 'zh-TW': '加班工時 (小時)', ms: 'Jam OT (jam)', my: 'OT အချိန်ပို (နာရီ)', hi: 'ओटी घंटे (घंटे)', bn: 'ওটি কাজের সময় (ঘণ্টা)' },
    { en: 'e.g.: 2.0', 'zh-CN': '例: 2.0', 'zh-TW': '例: 2.0', ms: 'Cth: 2.0', my: 'ဥပမာ: 2.0', hi: 'उदा: 2.0', bn: 'যেমন: ২.০' },
    { en: 'OT Reason & Tasks', 'zh-CN': '加班原因与任务', 'zh-TW': '加班原因與任務', ms: 'Sebab & Tugas OT', my: 'OT အကြောင်းရင်းနှင့် တာဝန်', hi: 'ओटी का कारण और कार्य', bn: 'ওটি এর কারণ এবং দায়িত্ব' },
    { en: 'e.g.: Mesh change, rush delivery shipment', 'zh-CN': '例: 换网调机、紧急赶工出货', 'zh-TW': '例: 換網調機、緊急趕工出貨', ms: 'Cth: Tukar jaring, kejar penghantaran segera', my: 'ဥပမာ: ပိုက်လဲခြင်း၊ အရေးပေါ်ကုန်ပို့ရန် အချိန်ပိုဆင်းခြင်း', hi: 'उदा: जाली बदलना, तत्काल शिपमेंट', bn: 'যেমন: জাল পরিবর্তন, জরুরি চালান পাঠানো' },
    { en: 'Driver / Vehicle Plate', 'zh-CN': '关联司机 / 车牌', 'zh-TW': '關聯司機 / 車牌', ms: 'Pemandu / No Plat', my: 'ယာဉ်မောင်း / ယာဉ်နံပါတ်', hi: 'ड्राइवर / वाहन नंबर', bn: 'ড্রাইভার / গাড়ির নম্বর' },
    { en: 'e.g.: Driver Master / WXV 8899', 'zh-CN': '例: 张师傅 / WXV 8899', 'zh-TW': '例: 張師傅 / WXV 8899', ms: 'Cth: Pemandu Ah Zhang / WXV 8899', my: 'ဥပမာ: ယာဉ်မောင်း / WXV 8899', hi: 'उदा: ड्राइवर / WXV 8899', bn: 'যেমন: ড্রাইভার / WXV 8899' },
    { en: 'Trip Number', 'zh-CN': '行程Trip单号', 'zh-TW': '行程Trip單號', ms: 'Nombor Trip', my: 'ခရီးစဉ်အမှတ် Trip', hi: 'ट्रिप नंबर', bn: 'ট্রিপ নম্বর' },
    { en: 'e.g.: TRIP-2026-03', 'zh-CN': '例: TRIP-2026-03', 'zh-TW': '例: TRIP-2026-03', ms: 'Cth: TRIP-2026-03', my: 'ဥပမာ: TRIP-2026-03', hi: 'उदा: TRIP-2026-03', bn: 'যেমন: TRIP-2026-03' },
    { en: 'Assisted DO Numbers', 'zh-CN': '协助送货单 (DO No)', 'zh-TW': '協助送貨單 (DO No)', ms: 'DO Dibantu (DO No)', my: 'ကူညီပို့ဆောင်သော DO နံပါတ်', hi: 'सहायता प्राप्त डीओ नंबर', bn: 'সহায়তাপ্রাপ্ত ডিও নম্বর' },
    { en: 'e.g.: DO-8891, DO-8892', 'zh-CN': '例: DO-8891, DO-8892', 'zh-TW': '例: DO-8891, DO-8892', ms: 'Cth: DO-8891, DO-8892', my: 'ဥပမာ: DO-8891, DO-8892', hi: 'उदा: DO-8891, DO-8892', bn: 'যেমন: DO-8891, DO-8892' },
    { en: 'Handling Pallets', 'zh-CN': '搬运托数 (Pallets)', 'zh-TW': '搬運托數 (Pallets)', ms: 'Palet Dimuat', my: 'သယ်ယူသော ပက်လက်အရေအတွက်', hi: 'हैंडलिंग पैलेट', bn: 'হ্যান্ডলিং প্যালেট' },
    { en: 'e.g.: 10 Pallets', 'zh-CN': '例: 10 托', 'zh-TW': '例: 10 托', ms: 'Cth: 10 Palet', my: 'ဥပမာ: ၁၀ ပက်လက်', hi: 'उदा: 10 पैलेट', bn: 'যেমন: ১০ প্যালেট' },
    { en: 'Warehouse Bay / Location', 'zh-CN': '存放库位 / 区域', 'zh-TW': '存放庫位 / 區域', ms: 'Lokasi / Ruang Gudang', my: 'ဂိုဒေါင်နေရာ / ဧရိယာ', hi: 'गोदाम स्थान / क्षेत्र', bn: 'গুদাম অবস্থান / এলাকা' },
    { en: 'Cargo Type / Model SKU', 'zh-CN': '货物类型 / 规格型号', 'zh-TW': '貨物類型 / 規格型號', ms: 'Jenis Kargo / Model SKU', my: 'ကုန်ပစ္စည်းအမျိုးအစား / မော်ဒယ်', hi: 'सामान प्रकार / मॉडल', bn: 'পণ্য ধরন / মডেল' },
    { en: 'e.g.: Resin bags / SF-500-150-18-CLR', 'zh-CN': '例: 原料树脂包 / SF-500-150-18-CLR', 'zh-TW': '例: 原料樹脂包 / SF-500-150-18-CLR', ms: 'Cth: Beg damar / SF-500-150-18-CLR', my: 'ဥပမာ: ကုန်ကြမ်းအိတ် / SF-500-150-18-CLR', hi: 'उदा: राल बैग / SF-500-150-18-CLR', bn: 'যেমন: রজন ব্যাগ / SF-500-150-18-CLR' },
    { en: 'Tracking Number', 'zh-CN': '运单号 / Tracking', 'zh-TW': '運單號 / Tracking', ms: 'Nombor Tracking', my: 'ခြေရာခံနံပါတ် Tracking', hi: 'ट्रैकिंग नंबर', bn: 'ট্র্যাকিং নম্বর' },
    { en: 'Parcel Count', 'zh-CN': '包裹件数', 'zh-TW': '包裹件數', ms: 'Bilangan Bungkusan', my: 'ပါဆယ်အရေအတွက်', hi: 'पार्सल संख्या', bn: 'পার্সেল সংখ্যা' },
    { en: 'e.g.: 5 Parcels', 'zh-CN': '例: 5 件', 'zh-TW': '例: 5 件', ms: 'Cth: 5 Bungkusan', my: 'ဥပမာ: ၅ ထုပ်', hi: 'उदा: 5 पैकेट', bn: 'যেমন: ৫ প্যাকেট' },
    { en: 'VIP Customer', 'zh-CN': 'VIP 客户名称', 'zh-TW': 'VIP 客戶名稱', ms: 'Pelanggan VIP', my: 'VIP ဖောက်သည်အမည်', hi: 'वीआईपी ग्राहक का नाम', bn: 'ভিআইপি গ্রাহকের নাম' },
    { en: 'e.g.: TopGlove / Key Account', 'zh-CN': '例: TopGlove / 某大客户', 'zh-TW': '例: TopGlove / 某大客戶', ms: 'Cth: TopGlove / Pelanggan Utama', my: 'ဥပမာ: TopGlove / အဓိကဖောက်သည်', hi: 'उदा: टॉपग्लोव / प्रमुख ग्राहक', bn: 'যেমন: টপগ্লোভ / প্রধান গ্রাহক' },
    { en: 'Special Order Notes / Urgency', 'zh-CN': '特单备注 / 紧急度', 'zh-TW': '特單備註 / 緊急度', ms: 'Nota Pesanan Khas / Urgensi', my: 'အထူးအော်ဒါမှတ်ချက် / အရေးပေါ်အဆင့်', hi: 'विशेष ऑर्डर नोट / तात्कालिकता', bn: 'বিশেষ অর্ডার নোট / জরুরিতা' },
    { en: 'Urgent Approved', 'zh-CN': '加急特批', 'zh-TW': '加急特批', ms: 'Kelulusan Segera', my: 'အရေးပေါ်ခွင့်ပြုပြီး', hi: 'तत्काल स्वीकृत', bn: 'জরুরি অনুমোদিত' },
    { en: 'Operator Notes / Remarks (Editable)', 'zh-CN': '操作员补充说明 / 文字备注 (可修改)', 'zh-TW': '操作員補充說明 / 文字備註 (可修改)', ms: 'Catatan Tambahan Operator (Boleh Edit)', my: 'အော်ပရေတာ ထပ်ဆောင်းမှတ်ချက် (ပြင်ဆင်နိုင်သည်)', hi: 'ऑपरेटर अतिरिक्त नोट्स / टिप्पणी (संपादन योग्य)', bn: 'অপারেটর অতিরিক্ত নোট / মন্তব্য (সম্পাদনাযোগ্য)' },
    { en: 'Add or edit notes here...', 'zh-CN': '可补充或修改说明备注...', 'zh-TW': '可補充或修改說明備註...', ms: 'Boleh tambah atau sunting catatan...', my: 'မှတ်ချက်များ ထပ်ဖြည့်နိုင်ပါသည်...', hi: 'नोट्स जोड़ें या संपादित करें...', bn: 'এখানে নোট যোগ বা সম্পাদনা করুন...' },

    // 提交动作与弹窗提示 Commit & Toasts
    { en: 'Saving record to database...', 'zh-CN': '正在记录落库...', 'zh-TW': '正在記錄落庫...', ms: 'Menyimpan rekod ke pangkalan data...', my: 'ဒေတာဘေ့စ်တွင် သိမ်းဆည်းနေသည်...', hi: 'डेटाबेस में सहेजा जा रहा है...', bn: 'ডাটাবেসে সংরক্ষণ করা হচ্ছে...' },
    { en: 'Confirm Clock Out Machine', 'zh-CN': '一键确认登出机台 (Clock Out)', 'zh-TW': '一鍵確認登出機台 (Clock Out)', ms: 'Sahkan Log Keluar Mesin (Clock Out)', my: 'စက်မှ ထွက်ခွာခြင်း အတည်ပြုပါ (Clock Out)', hi: 'मशीन क्लॉक आउट की पुष्टि करें (Clock Out)', bn: 'মেশিন ক্লক আউট নিশ্চিত করুন (Clock Out)' },
    { en: 'Confirm & Commit', 'zh-CN': '一键确认入库 (Commit)', 'zh-TW': '一鍵確認入庫 (Commit)', ms: 'Sahkan & Simpan (Commit)', my: 'အတည်ပြုပြီး သိမ်းဆည်းပါ (Commit)', hi: 'पुष्टि करें और इनटेक करें (Commit)', bn: 'নিশ্চিত করুন এবং জমা দিন (Commit)' },
    { en: 'Offline queue waiting for sync, will retry when network restores', 'zh-CN': '离线队列等待同步中，将在网络恢复时自动重试', 'zh-TW': '離線隊列等待同步中，將在網絡恢復時自動重試', ms: 'Barisan luar talian sedang menunggu, cuba semula bila talian pulih', my: 'အော့ဖ်လိုင်းတန်းစီဇယား စောင့်ဆိုင်းနေသည်၊ လိုင်းရပါက ပြန်လည်ကြိုးစားပါမည်', hi: 'ऑफ़लाइन कतार प्रतीक्षा कर रही है, नेटवर्क आने पर स्वतः पुनः प्रयास होगा', bn: 'অফলাইন সারি অপেক্ষা করছে, নেটওয়ার্ক ফিরে আসলে আবার চেষ্টা করা হবে' },
    { en: 'Current browser does not support speech recognition, please type manually', 'zh-CN': '当前浏览器不支持语音听写，请手动输入', 'zh-TW': '當前瀏覽器不支持語音聽寫，請手動輸入', ms: 'Pelayar tidak menyokong pengecaman suara, sila taip secara manual', my: 'လက်ရှိဘရောက်ဆာသည် အသံဖမ်းယူမှုကို မထောက်ပံ့ပါ၊ ကျေးဇူးပြု၍ စာရိုက်ပါ', hi: 'वर्तमान ब्राउज़र वॉयस इनपुट का समर्थन नहीं करता है, कृपया मैन्युअल टाइप करें', bn: 'বর্তমান ব্রাউজার ভয়েস ইনপুট সমর্থন করে না, দয়া করে টাইপ করুন' },
    { en: 'Please enter text notes or take a photo', 'zh-CN': '⚠️ 请输入文字说明或点击拍照', 'zh-TW': '⚠️ 請輸入文字說明或點擊拍照', ms: '⚠️ Sila masukkan teks atau ambil foto', my: '⚠️ ကျေးဇူးပြု၍ စာရေးပါ သို့မဟုတ် ဓာတ်ပုံရိုက်ပါ', hi: '⚠️ कृपया टेक्स्ट विवरण दर्ज करें या फ़ोटो लें', bn: '⚠️ দয়া করে টেক্সট লিখুন বা ছবি তুলুন' },
    { en: 'Logged out machine successfully! Current machine unlinked', 'zh-CN': '✅ 登出机台成功！已解除当前机台绑定', 'zh-TW': '✅ 登出機台成功！已解除當前機台綁定', ms: '✅ Berjaya log keluar mesin! Pautan mesin semasa dibatalkan', my: '✅ စက်မှ အောင်မြင်စွာ ထွက်ပြီးပါပြီ! လက်ရှိစက်ချိတ်ဆက်မှု ပြုတ်သွားပါပြီ', hi: '✅ मशीन से सफलतापूर्वक लॉग आउट! बाइंडिंग हटा दी गई', bn: '✅ মেশিন থেকে সফলভাবে লগ আউট! বাইন্ডিং মুছে ফেলা হয়েছে' },
    { en: 'Commit successful! Record archived to ledger', 'zh-CN': '✅ 入库成功！已自动沉淀到对应业务台账', 'zh-TW': '✅ 入庫成功！已自動沉澱到對應業務台賬', ms: '✅ Berjaya disimpan! Rekod telah diarkibkan ke lejar', my: '✅ အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ! မှတ်တမ်းကို စာရင်းသွင်းပြီးပါပြီ', hi: '✅ इनटेक सफल! रिकॉर्ड बहीखाते में दर्ज हो गया', bn: '✅ সফলভাবে জমা হয়েছে! রেকর্ড খাতায় সংরক্ষণ করা হয়েছে' },
    { en: 'No machine currently bound', 'zh-CN': '⚠️ 当前未绑定任何机台', 'zh-TW': '⚠️ 當前未綁定任何機台', ms: '⚠️ Tiada mesin terikat buat masa ini', my: '⚠️ လတ်တလောတွင် မည်သည့်စက်မျှ ချိတ်ဆက်မထားပါ', hi: '⚠️ वर्तमान में कोई मशीन लिंक नहीं है', bn: '⚠️ বর্তমানে কোনো মেশিন লিঙ্ক নেই' },
    { en: 'Could not detect valid machine QR code', 'zh-CN': '⚠️ 未能识别有效的机台二维码', 'zh-TW': '⚠️ 未能識別有效的機台二維碼', ms: '⚠️ Tidak dapat mengesan kod QR mesin yang sah', my: '⚠️ တရားဝင် စက် QR ကုဒ်ကို ရှာမတွေ့ပါ', hi: '⚠️ मान्य मशीन क्यूआर कोड नहीं पहचाना जा सका', bn: '⚠️ বৈধ মেশিন কিউআর কোড শনাক্ত করা যায়নি' },
    { en: 'Scan success! Switched and bound to machine:', 'zh-CN': '✅ 扫码成功！当前已切换绑定至机台:', 'zh-TW': '✅ 掃碼成功！當前已切換綁定至機台:', ms: '✅ Imbas berjaya! Kini beralih & terikat pada mesin:', my: '✅ စကင်န်ဖတ်ခြင်း အောင်မြင်သည်! စက်သို့ ပြောင်းလဲချိတ်ဆက်ပြီးပါပြီ:', hi: '✅ स्कैन सफल! मशीन से स्विच और बाइंड किया गया:', bn: '✅ স্ক্যান সফল! মেশিনে সুইচ ও লিঙ্ক করা হয়েছে:' },
    { en: 'Corrected to:', 'zh-CN': '已修正为:', 'zh-TW': '已修正為:', ms: 'Dibetulkan kepada:', my: 'သို့ ပြင်ဆင်ပြီး:', hi: 'संशोधित किया गया:', bn: 'সংশোধিত হয়েছে:' },
    { en: 'operator special work record', 'zh-CN': '操作员专项作业记录', 'zh-TW': '操作員專項作業記錄', ms: 'rekod kerja khas operator', my: 'အော်ပရေတာ အထူးလုပ်ငန်းမှတ်တမ်း', hi: 'ऑपरेटर विशेष कार्य रिकॉर्ड', bn: 'অপারেটর বিশেষ কাজের রেকর্ড' },
    { en: 'Are you sure you want to log out machine?', 'zh-CN': '确认要一键登出机台吗？', 'zh-TW': '確認要一鍵登出機台嗎？', ms: 'Adakah anda pasti mahu log keluar mesin?', my: 'စက်မှ ထွက်ခွာရန် သေချာပါသလား?', hi: 'क्या आप मशीन से लॉग आउट करना चाहते हैं?', bn: 'আপনি কি নিশ্চিত যে আপনি মেশিন থেকে লগ আউট করতে চান?' },
    { en: 'The system will record clock-out time and unbind the machine.', 'zh-CN': '系统将自动记录下线考勤时间并解除机台绑定。', 'zh-TW': '系統將自動記錄下線考勤時間並解除機台綁定。', ms: 'Sistem akan merekod jam keluar & nyahikat mesin.', my: 'စနစ်သည် အလုပ်ဆင်းချိန်ကို မှတ်တမ်းတင်ပြီး စက်ချိတ်ဆက်မှုကို ဖြုတ်ပါမည်။', hi: 'सिस्टम क्लॉक-आउट समय दर्ज करेगा और मशीन अनबाउंड करेगा।', bn: 'সিস্টেম ক্লক-আউট সময় রেকর্ড করবে এবং মেশিনটি আনবাউন্ড করবে।' },
    { en: 'Intake Error:', 'zh-CN': '入库异常:', 'zh-TW': '入庫異常:', ms: 'Ralat Simpan:', my: 'သိမ်းဆည်းရာတွင် အမှား:', hi: 'इनटेक त्रुटि:', bn: 'জমা দিতে ত্রুটি:' },
    { en: 'On-site Operator', 'zh-CN': '现场操作员', 'zh-TW': '現場操作員', ms: 'Operator Tapak', my: 'လုပ်ငန်းခွင် အော်ပရေတာ', hi: 'साइट ऑपरेटर', bn: 'অন-সাইট অপারেটর' },
    { en: 'Recognition failed:', 'zh-CN': '识别失败:', 'zh-TW': '識別失敗:', ms: 'Pengecaman gagal:', my: 'ခွဲခြမ်းစိတ်ဖြာမှု မအောင်မြင်ပါ:', hi: 'पहचान विफल:', bn: 'শনাক্তকরণ ব্যর্থ:' },
    { en: 'Network unstable', 'zh-CN': '网络不稳定', 'zh-TW': '網絡不穩定', ms: 'Rangkaian tidak stabil', my: 'လိုင်းမငြိမ်ပါ', hi: 'नेटवर्क अस्थिर है', bn: 'নেটওয়ার্ক অস্থির' },
    { en: 'Network restored, offline data synced', 'zh-CN': '✅ 网络已恢复，已自动同步离线数据', 'zh-TW': '✅ 網絡已恢復，已自動同步離線數據', ms: '✅ Rangkaian pulih, data luar talian diselaraskan', my: '✅ လိုင်းပြန်ရပါပြီ၊ အော့ဖ်လိုင်းဒေတာ ချိန်ကိုက်ပြီးပါပြီ', hi: '✅ नेटवर्क बहाल हुआ, ऑफ़लाइन डेटा सिंक हो गया', bn: '✅ নেটওয়ার্ক পুনরুদ্ধার হয়েছে, অফলাইন ডেটা সিঙ্ক হয়েছে' },
    { en: 'Logged out machine successfully', 'zh-CN': '✅ 已成功登出机台', 'zh-TW': '✅ 已成功登出機台', ms: '✅ Berjaya log keluar mesin', my: '✅ စက်မှ အောင်မြင်စွာ ထွက်ပြီးပါပြီ', hi: '✅ मशीन से सफलतापूर्वक लॉग आउट किया गया', bn: '✅ সফলভাবে মেশিন থেকে লগ আউট করা হয়েছে' },
    { en: 'Machine unlinked successfully', 'zh-CN': '✅ 已解除机台绑定', 'zh-TW': '✅ 已解除機台綁定', ms: '✅ Pautan mesin berjaya dibatalkan', my: '✅ စက်ချိတ်ဆက်မှု အောင်မြင်စွာ ဖြုတ်ပြီးပါပြီ', hi: '✅ मशीन बाइंडिंग सफलतापूर्वक हटा दी गई', bn: '✅ মেশিন আনলিঙ্ক সফল হয়েছে' }
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

