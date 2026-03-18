
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
    Scan,
    Truck,
    Package,
    Calendar,
    FileCheck,
    Database,
    FileText,
    Wrench,
    Cpu,
    FileBarChart,
    ArrowUpDown,
    Activity,
    ClipboardCheck,
    BookOpen,
    Camera
} from 'lucide-react';
import { supabase } from '../services/supabase';

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
    const [taskCount, setTaskCount] = useState(0);
    // DB-driven page permissions: Set<page_id> of allowed pages for this role
    const [dbAllowedPages, setDbAllowedPages] = useState<Set<string> | null>(null);

    const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

    // Special User Checks
    const isVivian = user?.email === 'diyadmin1111@gmail.com';
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
                    if (user?.email === 'diyadmin1111@gmail.com') {
                        ['order-summary', 'driver-management'].forEach(p => allowedSet.add(p));
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
        <div className="mb-6">
            <h3 className="px-4 text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 opacity-90">{title}</h3>
            <div className="space-y-1">
                {children}
            </div>
        </div>
    );

    const NavItem = ({ id, icon: Icon, label, roles, badge }: { id: string, icon: any, label: string, roles?: string[], badge?: number }) => {
        const isSuperAdmin = userRole === 'SuperAdmin' || user?.employeeId === '001';
        
        let hasAccess = false;

        if (isSuperAdmin) {
            hasAccess = true;
        } else {
            // Check hardcoded roles
            const hasHardcodedAccess = roles && userRole && roles.includes(userRole);
            // Check DB granted permissions
            const hasDbAccess = dbAllowedPages !== null && dbAllowedPages.has(id);
            
            hasAccess = hasHardcodedAccess || hasDbAccess;
        }

        if (!hasAccess) return null;

        const isActive = activePage === id;

        return (
            <button
                onClick={() => {
                    setActivePage(id);
                    setIsMobileMenuOpen(false);
                }}
                className={`relative w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group overflow-hidden ${isActive
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
                    <Icon size={20} className={isActive ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]' : 'group-hover:text-gray-200'} />
                </div>

                {/* Label */}
                <span className={`relative z-10 font-bold tracking-wide text-[15px] flex-1 text-left ${isActive ? 'text-white' : ''}`}>
                    {label}
                </span>

                {/* Badge */}
                {badge && badge > 0 && (
                    <span className="relative z-10 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-red-500/30">
                        {badge > 99 ? '99+' : badge}
                    </span>
                )}

                {/* Active Indicator Dot */}
                {isActive && (
                    <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                )}
            </button>
        );
    };

    // Check if we should show the global mobile header
    const hideGlobalMobileHeader = ([] as string[]).includes(activePage);

    return (
        <div className="min-h-screen bg-[#121215] text-gray-200 font-sans selection:bg-blue-500/30">
            {/* Mobile Header (Sticky Glass) */}
            {!hideGlobalMobileHeader && (
                <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#121215]/90 backdrop-blur-md border-b border-white/10 flex justify-between items-center px-4 z-50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-500 font-bold shadow-lg shadow-green-900/40">
                            P
                        </div>
                        <span className="font-bold text-lg tracking-tight text-white">PackSecure</span>
                    </div>
                    <button onClick={toggleMobileMenu} className="p-2 text-gray-400 active:text-white">
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            )}

            <div className="flex h-screen overflow-hidden pt-16 lg:pt-0">
                {/* Sidebar Navigation */}
                <aside className={`
                    fixed inset-y-0 left-0 z-[60] w-[280px] shrink-0 bg-[#1a1a1e] border-r border-white/5 flex flex-col
                    transform transition-transform duration-300 lg:transform-none lg:relative lg:translate-x-0
                    ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl shadow-black' : '-translate-x-full'}
                `}>
                    {/* Brand Area */}
                    <div className="relative flex flex-col px-6 pt-8 pb-8">
                        {/* Mobile Close Button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="lg:hidden absolute top-4 right-4 p-2 text-slate-500 hover:text-white bg-white/5 rounded-lg"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex items-center gap-3 mb-1">
                            <img src="/packsecure-logo.jpg" alt="PackSecure" className="h-10 rounded-lg" />
                            <div>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">System v6.7 • Data Center Active</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Links */}
                    <nav className="flex-1 overflow-y-auto px-4 custom-scrollbar space-y-2 pb-6">

                        {/* EXECUTIVE SUITE (SuperAdmin, Admin, Manager) */}
                        {/* VIVIAN'S EXCLUSIVE WORKSPACE */}
                        {isVivian && (
                            <NavGroup title="Vivian Workspace">
                                <NavItem id="livestock" icon={BarChart3} label="Live Stock" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                <NavItem id="delivery" icon={Truck} label="Trip Management" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                <NavItem id="order-summary" icon={FileBarChart} label="Daily Prep" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                <NavItem id="products" icon={Package} label="Product Library" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                <NavItem id="maintenance" icon={Wrench} label="Maintenance Control" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                <NavItem id="driver-management" icon={Users} label="Driver Management" roles={['SuperAdmin', 'Admin', 'Manager']} />
                            </NavGroup>
                        )}

                        {/* EXECUTIVE SUITE (SuperAdmin, Admin, Manager) - HIDDEN FROM VIVIAN */}
                        {!isVivian && (userRole === 'SuperAdmin' || userRole === 'Admin' || userRole === 'Manager' || user?.employeeId === '001' || user?.employeeId === '6965') && (
                            <>
                                <NavGroup title="Executive Suite">
                                    <NavItem id="factory-live-os" icon={LayoutDashboard} label="Factory Live OS" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="data-v2" icon={Database} label="Data Command" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                </NavGroup>

                                <NavGroup title="Operations">
                                    <NavItem id="scanner" icon={Scan} label="Production Control" roles={['SuperAdmin', 'Admin']} />
                                    <NavItem id="livestock" icon={BarChart3} label="Live Stock" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="machine-schedule" icon={Calendar} label="Machine Schedule" roles={['SuperAdmin', 'Admin', 'Manager']} />
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
                                    <NavItem id="report-history" icon={FileText} label="Reports" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                </NavGroup>

                                <NavGroup title="Organization">
                                    <NavItem id="leave-calendar" icon={Calendar} label="Leave Center" roles={['SuperAdmin', 'Admin', 'Manager', 'HR', 'Driver', 'Operator']} />
                                    <NavItem id="hr" icon={Users} label="HR Portal" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="driver-management" icon={Users} label="Driver Management" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="operators" icon={Users} label="操作员管理" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="reports" icon={FileBarChart} label="EXECUTIVE REPORTS" roles={['SuperAdmin', 'Manager']} />
                                    <NavItem id="iot" icon={Cpu} label="IOT SETTINGS" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="dev-log" icon={Activity} label="Dev Log" roles={['SuperAdmin', 'Admin']} />
                                    <div className="h-4" />
                                    {!isNeoson && <NavItem id="personal-report" icon={FileText} label="My Monthly Report" roles={['SuperAdmin', 'Admin', 'Manager']} />}
                                    <NavItem id="claims" icon={FileCheck} label="Claims" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                </NavGroup>
                                {!isNeoson && (
                                    <NavGroup title="Productivity">
                                        <NavItem id="sop-center" icon={BookOpen} label="SOP 指南" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                        <NavItem id="work-photos" icon={Camera} label="📸 工作记录" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                        <NavItem id="notes" icon={FileText} label="Notes" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                        <NavItem id="tasks" icon={ClipboardList} label="Tasks" roles={['SuperAdmin', 'Admin', 'Manager']} badge={taskCount} />
                                    </NavGroup>
                                )}
                            </>
                        )}

                        {/* DRIVER VIEW */}
                        {(userRole === 'Driver' || isNeoson) && (
                            <>
                                <NavGroup title="Driver Workspace">
                                    <NavItem id="delivery-driver" icon={Package} label="My Delivery" roles={['Driver', 'Manager']} />
                                    <NavItem id="delivery-history" icon={ClipboardList} label="My History" roles={['Driver', 'Manager']} />
                                    <NavItem id="driver-leave" icon={Calendar} label="Apply Cuti" roles={['Driver', 'Manager']} />
                                    <NavItem id="lorry-service" icon={Truck} label="Lorry Service" roles={['Driver', 'Manager']} />
                                    <NavItem id="personal-report" icon={FileText} label="My Monthly Report" roles={['Driver', 'Manager']} />
                                </NavGroup>

                                <NavGroup title="Productivity">
                                    <NavItem id="sop-center" icon={BookOpen} label="SOP 指南" roles={['Driver', 'Manager']} />
                                    <NavItem id="work-photos" icon={Camera} label="📸 工作记录" roles={['Driver', 'Manager']} />
                                    <NavItem id="notes" icon={FileText} label="Notes" roles={['Driver', 'Manager']} />
                                    <NavItem id="tasks" icon={ClipboardList} label="Tasks" roles={['Driver', 'Manager']} badge={taskCount} />
                                </NavGroup>
                            </>
                        )}

                        {/* HR VIEW */}
                        {userRole === 'HR' && (
                            <>
                                <NavGroup title="HR Workspace">
                                    <NavItem id="hr" icon={Users} label="HR Portal" roles={['HR']} />
                                    <NavItem id="driver-leave" icon={Calendar} label="Apply Leave" roles={['HR']} />
                                    <NavItem id="personal-report" icon={FileText} label="My Monthly Report" roles={['HR']} />
                                </NavGroup>

                                <NavGroup title="Productivity">
                                    <NavItem id="sop-center" icon={BookOpen} label="SOP 指南" roles={['HR']} />
                                    <NavItem id="work-photos" icon={Camera} label="📸 工作记录" roles={['HR']} />
                                    <NavItem id="notes" icon={FileText} label="Notes" roles={['HR']} />
                                    <NavItem id="tasks" icon={ClipboardList} label="Tasks" roles={['HR']} badge={taskCount} />
                                </NavGroup>
                            </>
                        )}

                        {/* OPERATOR VIEW */}
                        {userRole === 'Operator' && user?.employeeId !== '009' && (
                            <>
                                <NavGroup title="Production Floor">
                                    <NavItem id="scanner" icon={Scan} label="Production Control" roles={['Operator']} />
                                    <NavItem id="personal-report" icon={FileText} label="My Monthly Report" roles={['Operator']} />
                                </NavGroup>

                                <NavGroup title="Productivity">
                                    <NavItem id="sop-center" icon={BookOpen} label="SOP 指南" roles={['Operator']} />
                                    <NavItem id="work-photos" icon={Camera} label="📸 工作记录" roles={['Operator']} />
                                    <NavItem id="notes" icon={FileText} label="Notes" roles={['Operator']} />
                                    <NavItem id="tasks" icon={ClipboardList} label="Tasks" roles={['Operator']} badge={taskCount} />
                                </NavGroup>
                            </>
                        )}
                    </nav>

                    {/* User Profile (Bottom) */}
                    <div className="p-4 border-t border-white/5 bg-[#0a0a0c]">
                        <button
                            onClick={() => setActivePage('profile')}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group ${activePage === 'profile' ? 'bg-white/5 border border-white/5' : 'hover:bg-white/5 border border-transparent'
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
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#0a0a0c] rounded-full"></div>
                            </div>

                            <div className="text-left flex-1 min-w-0">
                                <p className="font-bold text-sm text-gray-200 truncate group-hover:text-white transition-colors">{user?.name || 'User'}</p>
                                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                                    {userRole || 'Guest'}
                                </p>
                                {user?.employeeId && (
                                    <p className="text-[10px] text-gray-600 font-mono tracking-widest mt-0.5">
                                        PIN: {user.employeeId}
                                    </p>
                                )}
                            </div>
                        </button>

                        <button
                            onClick={onLogout}
                            className="mt-3 w-full flex items-center justify-center gap-2 p-2.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all text-xs font-bold uppercase tracking-wider"
                        >
                            <LogOut size={14} />
                            <span>Sign Out</span>
                        </button>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto bg-[#121215] relative scroll-smooth selection:bg-purple-500/30">
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
                </main>
            </div>
        </div>
    );
};

export default Layout;
