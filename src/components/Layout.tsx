
import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    ClipboardList,
    BarChart3,
    Box,
    LogOut,
    User,
    Users,
    Menu,
    X,
    ChevronLeft,
    ChevronRight,
    Scan,
    Truck,
    Package,
    Calendar,
    Database,
    FileText,
    Wrench,
    Cpu,
    FileBarChart,
    ArrowUpDown,
    Activity,
    ClipboardCheck,
    BookOpen,
    Camera,
    Sun,
    Moon,
    Printer,
    FlaskConical,
    Bot,
    Lightbulb
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { canAccessPage } from '../utils/pageAccess';
import PageLogicDrawer from './PageLogicDrawer';
import { changeLanguage, LANGUAGES } from '../utils/i18n';

interface LayoutProps {
    children: React.ReactNode;
    activePage: string;
    setActivePage: (page: string) => void;
    userRole?: string;
    user?: any;
    onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activePage, setActivePage, userRole, user, onLogout }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
        () => localStorage.getItem('sidebarCollapsed') === 'true'
    );
    const [taskCount, setTaskCount] = useState(0);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    // DB-driven page permissions: Set<page_id> of allowed pages for this role
    const [dbAllowedPages, setDbAllowedPages] = useState<Set<string> | null>(null);
    const [showLangModal, setShowLangModal] = useState(false);

    // Languages Config
    const languages = [
        { code: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
        { code: 'zh-TW', label: '繁體中文', flag: '🇭🇰' },
        { code: 'en', label: 'English', flag: '🇬🇧' },
        { code: 'ms', label: 'Bahasa Melayu', flag: '🇲🇾' },
        { code: 'my', label: 'မြန်မာဘာသာ', flag: '🇲🇲' },
        { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
        { code: 'bn', label: 'বাংলা', flag: '🇧🇩' }
    ];

    const [currentLanguage, setCurrentLanguage] = useState(
        () => localStorage.getItem('packsecure_lang') || 'zh-CN'
    );

    const translateUI = (text: string) => {
        const savedLang = localStorage.getItem('packsecure_lang') || 'zh-CN';

        if (savedLang === 'en') {
            const enDict: { [key: string]: string } = {
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
                '库存审计': 'Inventory Audits',
                '物流工作空间': 'Logistics Workspace',
                '管理决策仓': 'Executive Suite',
                '司机工作空间': 'Driver Workspace',
                '人事工作空间': 'HR Workspace',
                '系统语言': 'System Language',
                '退出登录': 'Sign Out',
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
                '货车车队': 'Lorry Fleet',
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
                '机器 QR 标签': 'Machine QR Labels'
            };
            return enDict[text] || text;
        }

        if (savedLang === 'ms') {
            const msDict: { [key: string]: string } = {
                'SuperAdmin': 'Pentadbir Utama',
                'Admin': 'Pentadbir',
                'Manager': 'Pengurus',
                'Driver': 'Pemandu',
                'Operator': 'Operator',
                '超级管理员': 'Pentadbir Utama',
                '管理员': 'Pentadbir',
                '经理': 'Pengurus',
                '司机': 'Pemandu',
                '操作员': 'Operator',
                '多螺杆配料与Mix料': 'Resipi Skru & Campuran Bahan',
                '车间作业': 'Operasi Kilang',
                '库存与物料': 'Inventori & Bahan',
                '物流配送': 'Logistik & Penghantaran',
                '人事与系统': 'Organisasi & HR',
                '日常办公': 'Produktiviti',
                '生产作业空间': 'Lantai Pengeluaran',
                '库存审计': 'Audit Inventori',
                'Trip Management': 'Pengurusan Trip',
                'Daily Prep': 'Penyediaan Harian',
                'Inventory': 'Pengurusan Inventori',
                'Reports': 'Laporan',
                'SOP Center': 'Pusat SOP',
                'Notes': 'Nota',
                'Tasks': 'Tugas'
            };
            return msDict[text] || text;
        }

        if (savedLang === 'zh-TW') {
            const twDict: { [key: string]: string } = {
                'SuperAdmin': '超級管理員',
                'Admin': '管理員',
                'Manager': '經理',
                'Driver': '司機',
                'Operator': '操作員',
                '超级管理员': '超級管理員',
                '管理员': '管理員',
                '经理': '經理',
                '司机': '司機',
                '操作员': '操作員',
                '多螺杆配料与Mix料': '多螺杆配料與Mix料',
                '车间作业': '車間作業',
                '库存与物料': '庫存與物料',
                '物流配送': '物流配送',
                '人事与系统': '人事與系統',
                '日常办公': '日常辦公',
                '生产作业空间': '生產作業空間',
                '库存审计': '庫存審計',
                'Live Stock': '實時庫存',
                'Trip Management': '出車管理',
                'Daily Prep': '每日準備',
                'Product Library': '產品庫',
                'Maintenance Control': '設備維保',
                'Production Workspace': '生產工作區',
                'Machine Schedule': '排產計劃',
                'Floor Plan': '車間佈局圖',
                'Inventory': '庫存管理',
                'Stock Movement': '庫存變動',
                'Stock Audit': '庫存盤點',
                'Audit Report': '盤點報告',
                'Lorry Fleet': '貨車車隊',
                'Production Logs': '生產記錄',
                'Reports': '報表中心',
                'Report History': '歷史報表',
                'Leave Center': '考勤請假',
                'Staff Hub / HR Portal': '人事看板 / HR門戶',
                'IOT SETTINGS': '物聯網設置',
                'Dev Log': '開發日誌',
                'Activity Logs': '操作日誌',
                'My Monthly Report': '我的月度報告',
                'SOP Center': 'SOP 中心',
                '📸 Work Photos': '📸 工作照片',
                'Notes': '備忘錄',
                'Tasks': '任務看板',
                'My Deliveries': '我的配送',
                'Delivery History': '出車歷史',
                'Staff Hub': '員工看板',
                'Lorry Service': '車輛維修',
                'HR Portal': 'HR 門戶',
                'Yield & AI Learning': '收益率與 AI 學習',
                'Machine QR Labels': '機器 QR 標籤'
            };
            return twDict[text] || text;
        }

        // 默认 zh-CN (简体中文)
        const cnDict: { [key: string]: string } = {
            'SuperAdmin': '超级管理员',
            'Admin': '管理员',
            'Manager': '经理',
            'LogisticsCoordinator': '物流协调员',
            'Driver': '司机',
            'HR': '考勤/HR',
            'Operator': '操作员',
            'Guest': '访客',
            'Logistics Workspace': '物流工作空间',
            'Executive Suite': '管理决策仓',
            'Operations': '车间作业',
            'Inventory & BOM': '库存与物料',
            'Logistics': '物流配送',
            'Organization': '人事与系统',
            'Productivity': '日常办公',
            'Driver Workspace': '司机工作空间',
            'HR Workspace': '人事工作空间',
            'Production Floor': '生产作业空间',
            'Inventory Audits': '库存审计',
            'System v6.7 • Data Center Active': '系统 v6.7 • 数据中心运行中',
            'Dark': '深色',
            'Light': '浅色',
            'Quit': '退出登录',
            'System Language / 系统语言': '系统语言',
            'Expand sidebar': '展开侧栏',
            'Collapse sidebar': '折叠侧栏',
            'PIN: ': '工号: ',
            'Live Stock': '实时库存',
            'Trip Management': '出车管理',
            'Daily Prep': '每日准备',
            'Product Library': '产品库',
            'Maintenance Control': '设备维保',
            'Driver Management': '司机管理',
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
            'Production Logs': '生产记录',
            'Reports': '报表中心',
            'Report History': '历史报表',
            'Leave Center': '考勤请假',
            'Staff Hub / HR Portal': '人事看板 / HR门户',
            'EXECUTIVE REPORTS': '管理层报表',
            'IOT SETTINGS': '物联网设置',
            'Dev Log': '开发日志',
            'Activity Logs': '操作日志',
            'My Monthly Report': '我的月度报告',
            'Monthly Report': '月度报告',
            'SOP Center': 'SOP 中心',
            '📸 Work Photos': '📸 工作照片',
            'Notes': '备忘录',
            'Tasks': '任务看板',
            'My Deliveries': '我的配送',
            'Delivery History': '出车历史',
            'Staff Hub': '员工看板',
            'Lorry Service': '车辆维修',
            'HR Portal': 'HR 门户',
            'Yield & AI Learning': '收率与 AI 学习',
            'Machine QR Labels': '机器 QR 标签',
        };

        return cnDict[text] || text;
    };

    const loadGoogleTranslateScript = () => {
        if (document.querySelector('script[src*="translate.google.com"]')) {
            return;
        }

        (window as any).googleTranslateElementInit = () => {
            new (window as any).google.translate.TranslateElement({
                pageLanguage: 'zh-CN',
                includedLanguages: 'zh-CN,zh-TW,en,ms,my,hi,bn',
                autoDisplay: false
            }, 'google_translate_element');
        };

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        document.head.appendChild(script);
    };

    const clearGoogleTranslateCookies = () => {
        const domains = [
            "",
            window.location.hostname,
            "." + window.location.hostname,
            window.location.hostname.split('.').slice(-2).join('.'),
            "." + window.location.hostname.split('.').slice(-2).join('.')
        ];
        const paths = ["/", "/packsecure", "/src"];
        
        domains.forEach(domain => {
            paths.forEach(path => {
                let cookieString = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
                if (path) cookieString += ` path=${path};`;
                if (domain) cookieString += ` domain=${domain};`;
                document.cookie = cookieString;
            });
        });
    };

    const handleLanguageChange = (langCode: string) => {
        setCurrentLanguage(langCode);
        localStorage.setItem('packsecure_lang', langCode);
        document.documentElement.lang = langCode;

        if (langCode === 'zh-CN') {
            clearGoogleTranslateCookies();
            window.location.reload();
            return;
        }

        // 设置 Google Translate 全局 Cookie
        document.cookie = `googtrans=/zh-CN/${langCode}; path=/;`;
        document.cookie = `googtrans=/auto/${langCode}; path=/;`;
        document.cookie = `googtrans=/zh-CN/${langCode}; path=/; domain=` + window.location.hostname;
        document.cookie = `googtrans=/auto/${langCode}; path=/; domain=` + window.location.hostname;

        loadGoogleTranslateScript();

        const selectEl = document.querySelector('.goog-te-combo') as HTMLSelectElement;
        if (selectEl) {
            selectEl.value = langCode;
            selectEl.dispatchEvent(new Event('change'));
        }

        // 页面刷新，触发原生 UI 字典与整页全自动更新
        setTimeout(() => {
            window.location.reload();
        }, 150);
    };

    useEffect(() => {
        const savedLang = localStorage.getItem('packsecure_lang') || 'zh-CN';
        document.documentElement.lang = savedLang;
        
        if (savedLang === 'zh-CN') {
            clearGoogleTranslateCookies();
            return;
        }

        // Load translate elements dynamically for foreign languages
        loadGoogleTranslateScript();

        let attempts = 0;
        const interval = setInterval(() => {
            const selectEl = document.querySelector('.goog-te-combo') as HTMLSelectElement;
            if (selectEl) {
                selectEl.value = savedLang;
                selectEl.dispatchEvent(new Event('change'));
                clearInterval(interval);
            }
            attempts++;
            if (attempts > 30) {
                clearInterval(interval);
            }
        }, 500);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

    const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

    const toggleSidebarCollapsed = () => setIsSidebarCollapsed(prev => !prev);

    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', String(isSidebarCollapsed));
    }, [isSidebarCollapsed]);

    useEffect(() => {
        const collapseForOverlay = () => setIsSidebarCollapsed(true);
        window.addEventListener('packsecure:overlay-open', collapseForOverlay);
        return () => window.removeEventListener('packsecure:overlay-open', collapseForOverlay);
    }, []);

    /** Collapsed icon-only mode applies on desktop (lg+) only; mobile drawer always shows labels */
    const [isLgUp, setIsLgUp] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
    );
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1024px)');
        const onChange = () => setIsLgUp(mq.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);
    /** Desktop-only icon rail; phones/tablets always show menu text */
    const useCollapsedNavLayout = isSidebarCollapsed && isLgUp;
    const showNavLabels = !isLgUp || !isSidebarCollapsed;

    const isNeoson = user?.email === 'neosonchun@gmail.com';

    useEffect(() => {
        if (user) {
            fetchTaskCount();
            // Subscribe to task changes
            const channel = supabase.channel('layout-task-count')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                    fetchTaskCount();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [user]);

    // Fetch DB-driven page permissions for this role
    useEffect(() => {
        if (!userRole || userRole === 'SuperAdmin') return;
        supabase
            .from('role_permissions')
            .select('page_id, allowed')
            .eq('role_name', userRole)
            .then(({ data }) => {
                if (data && data.length > 0) {
                    const allowedSet = new Set<string>(
                        data.filter(r => r.allowed).map(r => r.page_id)
                    );
                    
                    // --- SPECIAL OVERRIDES MATCHING App.tsx ---
                    if (user?.email === 'neosonchun@gmail.com') {
                        ['delivery-driver', 'delivery-history', 'leave-calendar', 'lorry-service'].forEach(p => allowedSet.add(p));
                    }
                    // --- COMBINE CUSTOM MODULE UNLOCKS ---
                    if (user?.roleModules && user.roleModules.length > 0) {
                        user.roleModules.forEach((p: string) => allowedSet.add(p));
                    }

                    setDbAllowedPages(allowedSet);
                }
                // If no DB records for this role, keep null → fall back to hardcoded
            });
    }, [userRole, user?.email]);

    const fetchTaskCount = async () => {
        if (!user) return;
        const { count, error } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', user.uid)
            .neq('status', 'Done');

        if (!error && count !== null) {
            setTaskCount(count);
        }
    };

    const NavGroup = ({ title, children }: { title: string, children: React.ReactNode }) => (
        <div className={useCollapsedNavLayout ? 'mb-3' : 'mb-6'}>
            {showNavLabels && (
                <h3 className="px-4 text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 opacity-90">{translateUI(title)}</h3>
            )}
            <div className="space-y-1">
                {children}
            </div>
        </div>
    );

    const NavItem = ({ id, icon: Icon, label, roles, badge }: { id: string, icon: any, label: string, roles?: string[], badge?: number }) => {
        const isSuperAdmin = userRole === 'SuperAdmin' || user?.employeeId === '001';

        const hasAccess = canAccessPage(id, {
            isSuperAdmin,
            userRole,
            navRoles: roles,
            dbAllowedPages,
            roleModules: user?.roleModules,
        });

        if (!hasAccess) return null;

        const isActive = activePage === id;

        return (
            <button
                type="button"
                title={showNavLabels ? undefined : translateUI(label)}
                onClick={() => {
                    setActivePage(id);
                    setIsMobileMenuOpen(false);
                }}
                className={`relative w-full flex items-center rounded-xl transition-all duration-300 group ${useCollapsedNavLayout ? 'justify-center px-2 py-3 overflow-hidden' : 'gap-3 px-4 py-3.5'} ${isActive
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
            >
                {/* Active Background Glow */}
                {isActive && (
                    <div className="absolute inset-0 bg-white/[0.06] border border-white/5 shadow-inner" />
                )}

                {/* Icon */}
                <div className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    <Icon size={20} className={isActive ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(233,113,50,0.5)]' : 'group-hover:text-gray-200'} />
                </div>

                {/* Label */}
                {showNavLabels && (
                    <span className={`relative z-10 font-bold tracking-wide text-[15px] flex-1 text-left min-w-0 ${isActive ? 'text-white' : ''}`}>
                        {translateUI(label)}
                    </span>
                )}

                {/* Badge */}
                {badge && badge > 0 && (
                    <span className={`relative z-10 bg-red-500 text-white font-bold rounded-full shadow-lg shadow-red-500/30 ${useCollapsedNavLayout ? 'absolute -top-0.5 -right-0.5 text-[9px] min-w-[16px] h-4 flex items-center justify-center px-1' : 'text-[10px] px-2 py-0.5'}`}>
                        {badge > 99 ? '99+' : badge}
                    </span>
                )}

                {/* Active Indicator Dot */}
                {isActive && !useCollapsedNavLayout && (
                    <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(233,113,50,0.8)]" />
                )}
            </button>
        );
    };

    // Check if we should show the global mobile header
    const hideGlobalMobileHeader = ([] as string[]).includes(activePage);

    return (
        <div className="min-h-screen bg-apple-bg text-apple-textMain font-sans selection:bg-blue-500/30 transition-colors duration-300">
            {/* Mobile Header (Sticky Glass) */}
            {!hideGlobalMobileHeader && (
                <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-apple-bg/90 backdrop-blur-md border-b border-apple-border flex justify-between items-center px-3 z-50 transition-colors duration-300">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-green-500/20 flex items-center justify-center text-green-500 font-bold shadow-lg shadow-green-900/40 text-sm">
                            P
                        </div>
                        <span className="font-bold text-base tracking-tight text-white dark:text-white">PackSecure</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {/* 👤 Click Avatar to open My Profile */}
                        <button
                            type="button"
                            onClick={() => { setActivePage('profile'); setIsMobileMenuOpen(false); }}
                            title="View My Profile / 个人主页"
                            className="w-8 h-8 rounded-full bg-gray-800 border-2 border-orange-500/80 overflow-hidden flex items-center justify-center cursor-pointer shadow-md active:scale-95 transition-all mr-1"
                        >
                            {user?.photoURL ? (
                                <img src={user.photoURL} alt="User Profile" className="w-full h-full object-cover" />
                            ) : (
                                <User size={16} className="text-orange-400" />
                            )}
                        </button>
                        {/* 📱 移动端触控语言切换按钮 */}
                        <button
                            type="button"
                            onClick={() => setShowLangModal(true)}
                            className="bg-gray-800/90 border border-gray-700 rounded-xl text-xs font-bold text-amber-300 px-2.5 py-1.5 flex items-center gap-1 shadow-md active:scale-95 transition cursor-pointer"
                        >
                            <span>{LANGUAGES.find(l => l.code === currentLanguage)?.flag || '🌐'}</span>
                            <span>{LANGUAGES.find(l => l.code === currentLanguage)?.label.split(' ')[0] || '语言'}</span>
                        </button>
                        <button onClick={toggleTheme} className="p-1.5 text-gray-400 hover:text-amber-400 transition-colors">
                            {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} className="text-amber-500" />}
                        </button>
                        <button onClick={toggleMobileMenu} className="p-1.5 text-gray-400 active:text-white">
                            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </div>
            )}

            <div className="flex h-screen overflow-hidden pt-16 lg:pt-0">
                {/* Sidebar Navigation */}
                <aside className={`
                    fixed left-0 z-[60] shrink-0 bg-apple-surface border-r border-apple-border flex flex-col transition-colors duration-300
                    top-16 bottom-0 lg:top-0 lg:inset-y-0
                    transform transition-all duration-300 lg:transform-none lg:relative lg:translate-x-0
                    ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl shadow-black w-[280px]' : '-translate-x-full w-[280px]'}
                    ${isSidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-[280px]'}
                `}>
                    {/* Brand Area */}
                    <div className={`relative flex flex-col pt-8 pb-6 ${useCollapsedNavLayout ? 'px-2 items-center' : 'px-6'}`}>
                        <button
                            type="button"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="lg:hidden absolute top-4 right-4 p-2 text-slate-500 hover:text-white bg-white/5 rounded-lg"
                        >
                            <X size={20} />
                        </button>
                        <button
                            type="button"
                            onClick={toggleSidebarCollapsed}
                            title={isSidebarCollapsed ? translateUI('Expand sidebar') : translateUI('Collapse sidebar')}
                            className="hidden lg:flex absolute top-4 right-2 p-2 text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                        </button>
                        <div className={`flex items-center mb-1 ${useCollapsedNavLayout ? 'justify-center' : 'gap-3'}`}>
                            <img src="/packsecure-logo.png" alt="PackSecure" className={`object-contain filter drop-shadow-md ${useCollapsedNavLayout ? 'h-8 max-w-full' : 'h-9 max-w-full'}`} />
                            {showNavLabels && (
                                <div>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{translateUI('System v6.7 • Data Center Active')}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <nav className={`flex-1 overflow-y-auto custom-scrollbar space-y-2 pb-6 ${useCollapsedNavLayout ? 'px-2' : 'px-4'}`}>

                        {/* EXECUTIVE SUITE (SuperAdmin, Admin, Manager) */}
                        {/* Logistics coordinator workspace (menu via role_permissions in DB) */}
                        {userRole === 'LogisticsCoordinator' && (
                            <NavGroup title="Logistics Workspace">
                                <NavItem id="livestock" icon={BarChart3} label="Live Stock" roles={['LogisticsCoordinator']} />
                                <NavItem id="delivery" icon={Truck} label="Trip Management" roles={['LogisticsCoordinator']} />
                                <NavItem id="order-summary" icon={FileBarChart} label="Daily Prep" roles={['LogisticsCoordinator']} />
                                <NavItem id="products" icon={Package} label="Product Library" roles={['LogisticsCoordinator']} />
                                <NavItem id="maintenance" icon={Wrench} label="Maintenance Control" roles={['LogisticsCoordinator']} />
                                <NavItem id="driver-management" icon={Users} label="Driver Management" roles={['LogisticsCoordinator']} />
                                <NavItem id="reports" icon={FileBarChart} label="Reports" roles={['LogisticsCoordinator']} />
                            </NavGroup>
                        )}

                        {/* EXECUTIVE SUITE (SuperAdmin, Admin, Manager) */}
                        {userRole !== 'LogisticsCoordinator' && (userRole === 'SuperAdmin' || userRole === 'Admin' || userRole === 'Manager' || user?.employeeId === '001' || user?.employeeId === '6965') && (
                            <>
                                <NavGroup title="Executive Suite">
                                    <NavItem id="factory-live-os" icon={LayoutDashboard} label="Factory Live OS" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="data-v2" icon={Database} label="Data Command" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                </NavGroup>

                                <NavGroup title="Operations">
                                    <NavItem id="scanner" icon={Scan} label="Production Workspace" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="raw_material_mobile" icon={FlaskConical} label="多螺杆配料与Mix料" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="livestock" icon={BarChart3} label="Live Stock" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="recipes" icon={Activity} label="Yield & AI Learning" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="machine-schedule" icon={Calendar} label="Machine Schedule" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="machine-labels" icon={Printer} label="Machine QR Labels" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="floor-plan" icon={LayoutDashboard} label="Floor Plan" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                </NavGroup>

                                <NavGroup title="Inventory & BOM">
                                    <NavItem id="inventory" icon={Box} label="Inventory" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="products" icon={Package} label="Product Library" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="stock-movement" icon={ArrowUpDown} label="Stock Movement" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="stock-audit" icon={ClipboardCheck} label="Stock Audit" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="audit-report" icon={FileBarChart} label="Audit Report" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                </NavGroup>

                                <NavGroup title="Logistics">
                                    <NavItem id="delivery" icon={Truck} label="Trip Management" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="order-summary" icon={FileBarChart} label="Daily Prep" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="maintenance" icon={Wrench} label="Maintenance Control" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="lorry-management" icon={Truck} label="Lorry Fleet" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="production" icon={Database} label="Production Logs" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="report-history" icon={FileText} label="Report History" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                </NavGroup>

                                <NavGroup title="Organization">
                                    <NavItem id="leave-calendar" icon={Calendar} label="Leave Center" roles={['SuperAdmin', 'Admin', 'Manager', 'HR', 'Driver', 'Operator']} />
                                    <NavItem id="hr" icon={Users} label="Staff Hub / HR Portal" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="reports" icon={FileBarChart} label="Reports" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="iot" icon={Cpu} label="IOT SETTINGS" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="dev-log" icon={Activity} label="Dev Log" roles={['SuperAdmin', 'Admin']} />
                                    <NavItem id="activity-logs" icon={Activity} label="Activity Logs" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <div className="h-4" />
                                    {!isNeoson && <NavItem id="personal-report" icon={FileText} label="My Monthly Report" roles={['SuperAdmin', 'Admin', 'Manager']} />}
                                </NavGroup>

                                {!isNeoson && (
                                    <NavGroup title="Productivity">
                                        <NavItem id="sop-center" icon={BookOpen} label="SOP Center" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                        <NavItem id="work-photos" icon={Camera} label="📸 Work Photos" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                        <NavItem id="notes" icon={FileText} label="Notes" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                        <NavItem id="tasks" icon={ClipboardList} label="Tasks" roles={['SuperAdmin', 'Admin', 'Manager']} badge={taskCount} />
                                    </NavGroup>
                                )}
                            </>
                        )}

                        {/* DRIVER VIEW */}
                        {(userRole === 'Driver' || isNeoson || user?.roleModules?.includes('delivery-driver') || user?.roleModules?.includes('delivery-history')) && (
                            <>
                                <NavGroup title="Driver Workspace">
                                    <NavItem id="delivery-driver" icon={Package} label="My Deliveries" roles={['Driver', 'Manager']} />
                                    <NavItem id="delivery-history" icon={ClipboardList} label="Delivery History" roles={['Driver', 'Manager']} />
                                    <NavItem id="driver-leave" icon={Calendar} label="Staff Hub" roles={['Driver', 'Manager']} />
                                    <NavItem id="lorry-service" icon={Truck} label="Lorry Service" roles={['Driver', 'Manager']} />
                                    <NavItem id="personal-report" icon={FileText} label="Monthly Report" roles={['Driver', 'Manager']} />
                                </NavGroup>

                                <NavGroup title="Productivity">
                                    <NavItem id="sop-center" icon={BookOpen} label="SOP Center" roles={['Driver', 'Manager']} />
                                    <NavItem id="work-photos" icon={Camera} label="📸 Work Photos" roles={['Driver', 'Manager']} />
                                    <NavItem id="notes" icon={FileText} label="Notes" roles={['Driver', 'Manager']} />
                                    <NavItem id="tasks" icon={ClipboardList} label="Tasks" roles={['Driver', 'Manager']} badge={taskCount} />
                                    <NavItem id="activity-logs" icon={Activity} label="Activity Logs" roles={['Driver', 'Manager']} />
                                </NavGroup>
                            </>
                        )}

                        {/* HR VIEW */}
                        {userRole === 'HR' && (
                            <>
                                <NavGroup title="HR Workspace">
                                    <NavItem id="hr" icon={Users} label="HR Portal" roles={['HR']} />
                                    <NavItem id="driver-leave" icon={Calendar} label="Staff Hub" roles={['HR']} />
                                    <NavItem id="personal-report" icon={FileText} label="My Monthly Report" roles={['HR']} />
                                </NavGroup>

                                <NavGroup title="Productivity">
                                    <NavItem id="sop-center" icon={BookOpen} label="SOP Center" roles={['HR']} />
                                    <NavItem id="work-photos" icon={Camera} label="📸 Work Photos" roles={['HR']} />
                                    <NavItem id="notes" icon={FileText} label="Notes" roles={['HR']} />
                                    <NavItem id="tasks" icon={ClipboardList} label="Tasks" roles={['HR']} badge={taskCount} />
                                    <NavItem id="activity-logs" icon={Activity} label="Activity Logs" roles={['HR']} />
                                </NavGroup>
                            </>
                        )}

                        {/* OPERATOR VIEW */}
                        {userRole === 'Operator' && user?.employeeId !== '009' && (
                            <>
                                <NavGroup title="Production Floor">
                                    <NavItem id="scanner" icon={Scan} label="Production Workspace" roles={['Operator']} />
                                    <NavItem id="raw_material_mobile" icon={FlaskConical} label="多螺杆配料与Mix料" roles={['Operator']} />
                                    <NavItem id="order-summary" icon={FileBarChart} label="Daily Prep" roles={['Operator']} />
                                    <NavItem id="personal-report" icon={FileText} label="My Monthly Report" roles={['Operator']} />
                                </NavGroup>

                                <NavGroup title="Productivity">
                                    <NavItem id="sop-center" icon={BookOpen} label="SOP Center" roles={['Operator']} />
                                    <NavItem id="work-photos" icon={Camera} label="📸 Work Photos" roles={['Operator']} />
                                    <NavItem id="notes" icon={FileText} label="Notes" roles={['Operator']} />
                                    <NavItem id="tasks" icon={ClipboardList} label="Tasks" roles={['Operator']} badge={taskCount} />
                                    <NavItem id="activity-logs" icon={Activity} label="Activity Logs" roles={['Operator']} />
                                </NavGroup>
                            </>
                        )}

                        {/* BABY OVERRIDE: STOCK AUDIT (Global visibility irrespective of evaluated Role) */}
                        {(user?.employeeId === '0014' || user?.email === 'driver.0014@packsecure.local' || user?.name?.toLowerCase() === 'baby') && (
                            <NavGroup title="Inventory Audits">
                                <NavItem id="stock-audit" icon={ClipboardCheck} label="Stock Audit" roles={['Operator', 'Driver', 'SuperAdmin', 'Admin', 'Manager', 'HR']} />
                            </NavGroup>
                        )}
                        {/* 🤖 AI 助理与 💡 本页逻辑说明 专用按钮 (移至左侧菜单) */}
                        <div className="px-3 pt-3 pb-2 border-t border-white/5 space-y-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    window.dispatchEvent(new CustomEvent('packsecure:open-ai-chat'));
                                }}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 text-blue-300 font-bold text-xs hover:from-blue-800/50 hover:to-indigo-800/50 transition shadow-sm active:scale-95 cursor-pointer ${useCollapsedNavLayout ? 'justify-center px-0' : ''}`}
                                title="🤖 AI 智能助理"
                            >
                                <Bot size={18} className="text-blue-400 shrink-0" />
                                {showNavLabels && <span>🤖 AI 智能助理</span>}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    window.dispatchEvent(new CustomEvent('packsecure:open-page-logic'));
                                }}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/30 text-purple-300 font-bold text-xs hover:from-purple-800/50 hover:to-indigo-800/50 transition shadow-sm active:scale-95 cursor-pointer ${useCollapsedNavLayout ? 'justify-center px-0' : ''}`}
                                title="💡 本页逻辑说明"
                            >
                                <Lightbulb size={18} className="text-amber-400 shrink-0 animate-pulse" />
                                {showNavLabels && <span>💡 本页逻辑说明</span>}
                            </button>
                        </div>
                    </nav>

                    {/* User Profile (Bottom) */}
                    <div className={`border-t border-white/5 bg-[#050505] ${useCollapsedNavLayout ? 'p-2' : 'p-4'}`}>
                        <button
                            type="button"
                            title={showNavLabels ? undefined : (user?.name || 'Profile')}
                            onClick={() => setActivePage('profile')}
                            className={`w-full flex items-center rounded-xl transition-all duration-300 group ${useCollapsedNavLayout ? 'justify-center p-2' : 'gap-3 p-3'} ${activePage === 'profile' ? 'bg-white/5 border border-white/5' : 'hover:bg-white/5 border border-transparent'
                                } `}
                        >
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden border-2 border-gray-700 group-hover:border-gray-500 transition-colors">
                                    {user?.photoURL ? (
                                        <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={18} className="text-gray-400" />
                                    )}
                                </div>
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#050505] rounded-full"></div>
                            </div>

                            {showNavLabels && (
                                <div className="text-left flex-1 min-w-0">
                                    <p className="font-bold text-sm text-gray-200 truncate group-hover:text-white transition-colors">{user?.name || 'User'}</p>
                                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                                        {translateUI(userRole || 'Guest')}
                                    </p>
                                    {user?.employeeId && (
                                        <p className="text-[10px] text-gray-600 font-mono tracking-widest mt-0.5">
                                            {translateUI('PIN: ')}{user.employeeId}
                                        </p>
                                    )}
                                </div>
                            )}
                        </button>

                        {/* PC Language Selector */}
                        {showNavLabels ? (
                            <div className="mt-3 px-1">
                                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1.5 opacity-90">{translateUI('System Language / 系统语言')}</label>
                                <select
                                    value={currentLanguage}
                                    onChange={(e) => handleLanguageChange(e.target.value)}
                                    className="bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-gray-300 px-2.5 py-2 w-full focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                                >
                                    {languages.map((lang) => (
                                        <option key={lang.code} value={lang.code} className="bg-[#121215] text-gray-300">
                                            {lang.flag} &nbsp; {lang.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    const currentIndex = languages.findIndex(l => l.code === currentLanguage);
                                    const nextIndex = (currentIndex + 1) % languages.length;
                                    handleLanguageChange(languages[nextIndex].code);
                                }}
                                title={`${translateUI('System Language / 系统语言')} (Current: ${languages.find(l => l.code === currentLanguage)?.label})`}
                                className="w-full flex items-center justify-center p-2 mt-3 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-xs font-bold font-mono"
                            >
                                {languages.find(l => l.code === currentLanguage)?.flag || '🌐'}
                            </button>
                        )}

                        <div className={`flex items-center mt-3 ${useCollapsedNavLayout ? 'flex-col gap-2' : 'gap-2'}`}>
                            <button
                                type="button"
                                title={useCollapsedNavLayout ? (theme === 'dark' ? translateUI('Dark') : translateUI('Light')) : undefined}
                                onClick={toggleTheme}
                                className={`flex items-center justify-center p-2.5 text-gray-400 hover:text-amber-400 hover:bg-white/5 rounded-lg transition-all text-xs font-bold uppercase tracking-wider ${useCollapsedNavLayout ? 'w-full' : 'flex-1 gap-2'}`}
                            >
                                {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} className="text-amber-500" />}
                                {showNavLabels && <span>{translateUI(theme === 'dark' ? 'Dark' : 'Light')}</span>}
                            </button>
                            <button
                                type="button"
                                title={translateUI('Quit')}
                                onClick={onLogout}
                                className={`flex items-center justify-center p-2.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all text-xs font-bold uppercase tracking-wider ${useCollapsedNavLayout ? 'w-full' : 'flex-1 gap-2'}`}
                            >
                                <LogOut size={14} />
                                {showNavLabels && <span>{translateUI('Quit')}</span>}
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto bg-apple-bg relative scroll-smooth selection:bg-purple-500/30 transition-colors duration-300">
                    {/* Mobile Overlay */}
                    {isMobileMenuOpen && (
                        <div
                            className="fixed inset-0 bg-black/80 z-30 lg:hidden backdrop-blur-sm transition-opacity"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />
                    )}

                    <div className="h-full w-full">
                        {children}
                    </div>

                    <PageLogicDrawer 
                        activePage={activePage} 
                        userRole={userRole} 
                        user={user} 
                        setActivePage={setActivePage} 
                    />
                </main>
            </div>

            {/* 📱 手机端专用大按钮多语言触控切换弹窗 (Mobile-Optimized Touch Language Modal) */}
            {showLangModal && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5 w-full max-w-xs space-y-4 shadow-2xl animate-fade-in">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                                🌐 选择系统语言 (Language)
                            </h3>
                            <button onClick={() => setShowLangModal(false)} className="text-gray-400 hover:text-white p-1 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5">
                            {LANGUAGES.map((lang) => {
                                const isSelected = currentLanguage === lang.code;
                                return (
                                    <button
                                        key={lang.code}
                                        onClick={() => {
                                            setCurrentLanguage(lang.code);
                                            setShowLangModal(false);
                                            changeLanguage(lang.code);
                                        }}
                                        className={`p-3.5 rounded-2xl border text-left flex items-center justify-between font-bold text-xs transition active:scale-95 cursor-pointer ${
                                            isSelected
                                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-lg'
                                                : 'bg-gray-950 border-gray-800 text-gray-300 hover:bg-gray-800'
                                        }`}
                                    >
                                        <span className="flex items-center gap-2.5 text-sm">
                                            <span className="text-base">{lang.flag}</span>
                                            <span>{lang.label}</span>
                                        </span>
                                        {isSelected && <span className="text-amber-400 font-extrabold">✓ 当前</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Layout;
