
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    LayoutDashboard,
    ClipboardList,
    BarChart3,
    Box,
    Boxes,
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
import { canAccessPage, computeEffectivePermissions } from '../utils/pageAccess';
import { MODULE_GROUPS, MODULE_REGISTRY } from '../config/modules';
import { useTranslation } from 'react-i18next';
import PageLogicDrawer from './PageLogicDrawer';
import { changeLanguage, LANGUAGES, t } from '../utils/i18n';
import SmartIntakeModal from './SmartIntakeModal';

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
    const isSuperAdmin = userRole === 'SuperAdmin';

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

    const { t: translate } = useTranslation();

    useEffect(() => {
        const handleLangChange = (e: any) => {
            setCurrentLanguage(e.detail || localStorage.getItem('packsecure_lang') || 'zh-CN');
        };
        window.addEventListener('packsecure:lang-change', handleLangChange);
        return () => window.removeEventListener('packsecure:lang-change', handleLangChange);
    }, []);

    const translateUI = (text: string) => {
        return translate(text, { defaultValue: text });
    };

    const handleLanguageChange = (langCode: string) => {
        setCurrentLanguage(langCode);
        changeLanguage(langCode as any);
    };

    useEffect(() => {
        const savedLang = localStorage.getItem('packsecure_lang') || 'zh-CN';
        document.documentElement.lang = savedLang;
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

    // Fetch DB-driven page permissions for this role & subscribe to realtime updates
    const fetchRolePerms = useCallback(() => {
        if (!userRole || userRole === 'SuperAdmin') {
            setDbAllowedPages(null);
            return;
        }
        supabase
            .from('role_permissions')
            .select('page_id, allowed')
            .eq('role_name', userRole)
            .then(({ data }) => {
                if (data && data.length > 0) {
                    const allowedSet = new Set<string>(
                        data.filter(r => r.allowed).map(r => r.page_id)
                    );
                    setDbAllowedPages(allowedSet);
                } else {
                    setDbAllowedPages(null);
                }
            });
    }, [userRole]);

    useEffect(() => {
        fetchRolePerms();

        const channel = supabase.channel('layout-role-permissions-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'role_permissions' }, () => {
                fetchRolePerms();
            })
            .subscribe();

        const handleUserPermUpdate = () => {
            fetchRolePerms();
        };
        window.addEventListener('packsecure:user-permissions-updated', handleUserPermUpdate);

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('packsecure:user-permissions-updated', handleUserPermUpdate);
        };
    }, [fetchRolePerms]);

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

    const effectivePermissions = useMemo(() => {
        return computeEffectivePermissions({
            role: userRole,
            isSuperAdmin,
            dbRoleAllowedPages: dbAllowedPages,
            userRoleModules: user?.roleModules || user?.role_modules || []
        });
    }, [userRole, isSuperAdmin, dbAllowedPages, user?.roleModules, user?.role_modules]);

    const hasAccess = useCallback((pageId: string) => {
        if (isSuperAdmin) return true;
        return effectivePermissions.has('*') || effectivePermissions.has(pageId);
    }, [isSuperAdmin, effectivePermissions]);

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

    const NavItem = ({ id, icon: Icon, label, badge }: { id: string, icon: any, label: string, badge?: number }) => {
        const itemHasAccess = hasAccess(id);

        if (!itemHasAccess) return null;

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

                        {/* DYNAMIC RBAC NAVIGATION DRIVEN BY MODULE_GROUPS & MODULE_REGISTRY */}
                        {MODULE_GROUPS.map(group => {
                            const groupModules = MODULE_REGISTRY.filter(
                                m => m.group === group.id && !m.hiddenFromNav && hasAccess(m.id)
                            );

                            if (groupModules.length === 0) return null;

                            return (
                                <NavGroup key={group.id} title={group.title}>
                                    {groupModules.map(mod => {
                                        const badge = mod.badgeKey === 'tasks' ? taskCount : undefined;
                                        return (
                                            <NavItem
                                                key={mod.id}
                                                id={mod.id}
                                                icon={mod.icon}
                                                label={mod.label}
                                                badge={badge}
                                            />
                                        );
                                    })}
                                </NavGroup>
                            );
                        })}
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

                    <SmartIntakeModal 
                        currentUser={user} 
                        pageContext={{ activePage, userRole }} 
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
