
import React, { useState } from 'react';
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
    BookOpen,
    DollarSign,
    Truck,
    Package,
    FileCheck,
    Database,
    FileText,
    FlaskConical // Added for Recipes
} from 'lucide-react';

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

    const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

    const NavGroup = ({ title, children }: { title: string, children: React.ReactNode }) => (
        <div className="mb-6">
            <h3 className="px-4 text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 opacity-90">{title}</h3>
            <div className="space-y-1">
                {children}
            </div>
        </div>
    );

    const NavItem = ({ id, icon: Icon, label, roles }: { id: string, icon: any, label: string, roles?: string[] }) => {
        // SuperAdmin implies access to everything, overriding specific role checks
        if (userRole !== 'SuperAdmin' && roles && userRole && !roles.includes(userRole)) return null;

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
                <span className={`relative z-10 font-bold tracking-wide text-[15px] ${isActive ? 'text-white' : ''}`}>
                    {label}
                </span>

                {/* Active Indicator Dot */}
                {isActive && (
                    <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                )}
            </button>
        );
    };

    return (
        <div className="min-h-screen bg-[#121215] text-gray-200 font-sans selection:bg-blue-500/30">
            {/* Mobile Header (Sticky Glass) */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#121215]/90 backdrop-blur-md border-b border-white/10 flex justify-between items-center px-4 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-900/40">
                        V
                    </div>
                    <span className="font-bold text-lg tracking-tight text-white">Venture OS</span>
                </div>
                <button onClick={toggleMobileMenu} className="p-2 text-gray-400 active:text-white">
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            <div className="flex h-screen overflow-hidden pt-16 lg:pt-0">
                {/* Sidebar Navigation */}
                <aside className={`
                    fixed inset-y-0 left-0 z-40 w-[280px] shrink-0 bg-[#1a1a1e] border-r border-white/5 flex flex-col
                    transform transition-transform duration-300 lg:transform-none lg:relative lg:translate-x-0
                    ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl shadow-black' : '-translate-x-full'}
                `}>        {/* Brand Area */}
                    <div className="hidden lg:flex flex-col px-6 pt-8 pb-8">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-[0_4px_20px_rgba(79,70,229,0.3)]">
                                V
                            </div>
                            <div>
                                <h1 className="font-black text-2xl tracking-tighter text-white leading-none">DIY VENTURE</h1>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">System Online</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Links */}
                    <nav className="flex-1 overflow-y-auto px-4 custom-scrollbar space-y-2 pb-6">
                        {/* SUPER ADMIN / MANAGER / ADMIN VIEW */}
                        {(userRole === 'SuperAdmin' || userRole === 'Admin' || userRole === 'Manager' || user?.employeeId === '001') && (
                            <>
                                <NavGroup title="Executive Suite">
                                    <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="data-v2" icon={Database} label="Data Command" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                </NavGroup>

                                <NavGroup title="Operations">
                                    <NavItem id="scanner" icon={Scan} label="Production Control" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="jobs" icon={ClipboardList} label="Job Orders" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="livestock" icon={BarChart3} label="Live Stock" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                </NavGroup>

                                <NavGroup title="Inventory & BOM">
                                    <NavItem id="inventory" icon={Box} label="Inventory" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="recipes" icon={FlaskConical} label="Recipe Manager" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="products" icon={Package} label="Product Library" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                </NavGroup>

                                <NavGroup title="Logistics">
                                    <NavItem id="delivery" icon={Truck} label="Delivery Orders" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="dispatch" icon={Truck} label="Dispatch" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="production" icon={Database} label="Production Logs" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="report-history" icon={FileText} label="Reports" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                </NavGroup>

                                <NavGroup title="Organization">
                                    <NavItem id="hr" icon={Users} label="HR Portal" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                    <NavItem id="users" icon={Users} label="User Management" roles={['SuperAdmin', 'Admin']} />
                                    <NavItem id="claims" icon={FileCheck} label="Claims" roles={['SuperAdmin', 'Admin', 'Manager']} />
                                </NavGroup>
                            </>
                        )}

                        {/* DRIVER VIEW */}
                        {userRole === 'Driver' && (
                            <NavGroup title="Driver Workspace">
                                <NavItem id="delivery-driver" icon={Package} label="My Delivery" roles={['Driver']} />
                                <NavItem id="claims" icon={FileCheck} label="My Claims" roles={['Driver']} />
                            </NavGroup>
                        )}

                        {/* OPERATOR VIEW */}
                        {userRole === 'Operator' && (
                            <NavGroup title="Production Floor">
                                <NavItem id="scanner" icon={Scan} label="Production Control" roles={['Operator']} />
                            </NavGroup>
                        )}
                    </nav>

                    {/* User Profile (Bottom) */}
                    <div className="p-4 border-t border-white/5 bg-[#0a0a0c]">
                        <button
                            onClick={() => setActivePage('profile')}
                            className={`w - full flex items - center gap - 3 p - 3 rounded - xl transition - all duration - 300 group ${activePage === 'profile' ? 'bg-white/5 border border-white/5' : 'hover:bg-white/5 border border-transparent'
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
