import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
// import Dashboard from './pages/Dashboard';
import ProductionLog from './pages/ProductionLog';
import Inventory from './pages/Inventory';
import Login from './pages/Login';
import Register from './pages/Register';

import ProductionControl from './pages/ProductionControl';
// import ProductionPlanning from './pages/ProductionPlanning';
import LiveStock from './pages/LiveStock';
import LiveFleet from './pages/LiveFleet';
import StockMovement from './pages/StockMovement';
import StockAudit from './pages/StockAudit';
import AuditReport from './pages/AuditReport';
import ProductLibrary from './pages/ProductLibrary';
import DeliveryOrderManagement from './pages/DeliveryOrderManagement';
import DriverDelivery from './pages/DriverDelivery';
import DriverHistory from './pages/DriverHistory';
import LorryService from './pages/LorryService';
import MaintenanceManagement from './pages/MaintenanceManagement';
import LorryManagement from './pages/LorryManagement';
// import Dispatch from './pages/Dispatch';
// import LoadingDock from './pages/LoadingDock';
import MachineLabels from './pages/MachineLabels';
import ExecutiveReports from './pages/ExecutiveReports';
import DataManagement from './pages/DataManagement';
import ReportHistory from './pages/ReportHistory';
import ProductionReports from './pages/ProductionReports';
import UnderConstruction from './pages/UnderConstruction';

import UpdatePassword from './pages/UpdatePassword';
import Profile from './pages/Profile';
import OrderSummary from './pages/OrderSummary'; // New Page
// import CustomerImport from './pages/CustomerImport'; // Added Import Page
// import UniversalIntake from './pages/UniversalIntake';
// import SimpleStock from './pages/SimpleStock';
import HRPortal from './pages/HRPortal';
import IoTManagement from './pages/IoTManagement';
import Notes from './pages/Notes';
import Tasks from './pages/Tasks';
import FactoryLiveOS from './pages/FactoryLiveOS';
import DevLog from './pages/DevLog';
import LeaveCalendar from './pages/LeaveCalendar';
import SOPCenter from './pages/SOPCenter';
import WorkPhotoLog from './pages/WorkPhotoLog';
import RawMaterialMobilePortal from './pages/RawMaterialMobilePortal';
import YieldControl from './pages/YieldControl';
import PersonalMonthlyReport from './pages/PersonalMonthlyReport';
import MachineSchedule from './pages/MachineSchedule';
import ActivityLogs from './pages/ActivityLogs';
import FloorPlan from './pages/FloorPlan';
import WilliamDocumentCenter from './pages/WilliamDocumentCenter';
import BossCoPilot from './pages/BossCoPilot';

import { User, UserRole, InventoryItem, ProductionLog as ProductionLogType, JobOrder } from './types';
import { mergeAllowedPages, computeEffectivePermissions } from './utils/pageAccess';
import AIAgentWidget from './components/AIAgentWidget';

import { supabase } from './services/supabase';
import { Session } from '@supabase/supabase-js';
import { logActivity } from './utils/logger';

// --- CONFIGURATION ---




function App() {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [user, setUser] = useState<User | null>(null);
    // IoT 模式：访问 #/production/... 或设备已绑定机器时，绕过 Supabase 登录
    const [isIoTMode, setIsIoTMode] = useState<boolean>(() => {
        return window.location.hash.startsWith('#/production/');
    });
    const [activePage, setActivePage] = useState<string>(() => {
        return localStorage.getItem('lastActivePage') || 'factory-live-os';
    });

    // Ensure default dark theme class on html tag
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, []);

    // Global client geolocation background listener
    useEffect(() => {
        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const gpsStr = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
                    sessionStorage.setItem('last_known_gps', gpsStr);
                    (window as any).__CURRENT_GPS__ = gpsStr;
                },
                () => {},
                { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
            );
        }
    }, []);

    // Persist activePage and Log Activity
    useEffect(() => {
        localStorage.setItem('lastActivePage', activePage);
        
        // Log page view when activePage changes and user is loaded
        if (user && activePage !== 'login') {
            logActivity(user, 'PAGE_VIEW', { page: activePage });
        }
    }, [activePage, user]);

    // Global Click Tracker to record button clicks and creations
    useEffect(() => {
        if (!user) return;
        
        const handleGlobalClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const clickable = target.closest('button, a, [role="button"], input[type="submit"]') as HTMLElement;
            
            if (clickable) {
                // Extract identifying information about what was clicked
                const rawText = (clickable.innerText || clickable.textContent || clickable.getAttribute('aria-label') || clickable.title || '').trim().replace(/\s+/g, ' ').substring(0, 60);
                const actionId = clickable.id || 'unknown_node';
                
                // Extract surrounding modal or container context
                const modalContainer = clickable.closest('[role="dialog"], .modal, [class*="modal"], [class*="drawer"], form, [class*="fixed inset-0"]');
                let modalTitle = '';
                let contextTarget = '';
                if (modalContainer) {
                    const titleEl = modalContainer.querySelector('h1, h2, h3, h4, [class*="title"], legend');
                    if (titleEl && titleEl !== clickable) {
                        modalTitle = (titleEl.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50);
                    }
                    const activeInput = modalContainer.querySelector('input[name*="customer"], select[name*="customer"], input[placeholder*="Customer"], input[placeholder*="customer"]') as HTMLInputElement;
                    if (activeInput && activeInput.value && activeInput.value.toLowerCase() !== 'general customer') {
                        contextTarget = `客户: ${activeInput.value}`;
                    }
                }

                const customAction = clickable.getAttribute('data-action') || clickable.getAttribute('data-action-name') || clickable.getAttribute('aria-label');
                const customTarget = clickable.getAttribute('data-target');
                
                // We only want to log 'action-oriented' clicks to avoid flooding the DB
                const textLower = (rawText + ' ' + (customAction || '')).toLowerCase();
                const keywords = ['save', 'submit', 'create', 'delete', 'add', 'update', 'complete', 'start', 'stop', 'confirm', 'print', 'finish', 'post', 'allow', 'reject', 'approve', 'sahkan', 'hantar', 'simpan', 'gambar'];
                
                const isActionable = keywords.some(k => textLower.includes(k));
                
                if (isActionable && rawText.length > 0) {
                    logActivity(user, `BUTTON_CLICK`, {
                        page: activePage,
                        button_text: rawText,
                        element_id: actionId,
                        modal_title: modalTitle || undefined,
                        target: customTarget || contextTarget || (modalTitle ? `【${modalTitle}】` : undefined),
                        custom_action: customAction || undefined
                    });
                }
            }
        };

        document.addEventListener('click', handleGlobalClick, { capture: true });
        return () => document.removeEventListener('click', handleGlobalClick, { capture: true });
    }, [user, activePage]);

    // Global State (Synced with Firestore)
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [logs, setLogs] = useState<ProductionLogType[]>([]);
    const [jobs, setJobs] = useState<JobOrder[]>([]);

    // DB-Driven Page Permissions
    const [dbAllowedPages, setDbAllowedPages] = useState<Set<string> | null>(null);
    const [permissionsLoaded, setPermissionsLoaded] = useState<boolean>(false);


    // 0. Auth & Router State
    useEffect(() => {
        // Initial Session Check
        supabase.auth.getSession().then(({ data: { session } }) => {
            handleSession(session);
        });

        // Listen for Changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setActivePage('update-password');
            }
            handleSession(session);
        });

        // Simple Hash Router for Machine Linking & Auth Errors
        const handleHash = () => {
            const hash = window.location.hash;

            // 1. Check for Auth Errors (Supabase)
            if (hash.includes('error=access_denied') && hash.includes('error_description=')) {
                const params = new URLSearchParams(hash.substring(1)); // remove #
                const errorDesc = params.get('error_description')?.replace(/\+/g, ' ');
                alert(`Login Error: ${errorDesc}\n\nPlease try sending the reset link again.`);
                // Clean URL
                window.history.replaceState(null, '', window.location.pathname);
                setActivePage('login');
                return;
            }

            // 2. Machine Deep Link  e.g. #/production/N1-M01
            if (hash.startsWith('#/production/')) {
                const machineId = hash.replace('#/production/', '');
                if (machineId) {
                    console.log("Deep Link Detected for Machine:", machineId);
                    // Store machine selection for ProductionControl to auto-select, but
                    // do NOT lock the user into device/kiosk mode via the hash anymore.
                    sessionStorage.setItem('selectedMachine', machineId);
                }
            }

            // 3. Customer Import Deep Link
            if (hash === '#/customers/import') {
                setActivePage('customer-import');
            }
            if (hash === '#/input' || hash === '#/universal-intake') {
                setActivePage('universal-intake');
            }
            if (hash === '#/simple-stock') {
                setActivePage('simple-stock');
            }
        };

        handleHash();
        window.addEventListener('hashchange', handleHash);

        return () => {
            subscription.unsubscribe();
            window.removeEventListener('hashchange', handleHash);
        };
    }, []);

    // --- REALTIME LISTENER FOR INDIVIDUAL USER PERMISSION UPDATES ---
    useEffect(() => {
        const handleUserPermUpdate = (e: any) => {
            if (e.detail && Array.isArray(e.detail)) {
                setUser((prev: any) => prev ? ({ ...prev, roleModules: e.detail }) : prev);
            }
        };
        window.addEventListener('packsecure:user-permissions-updated', handleUserPermUpdate);
        return () => window.removeEventListener('packsecure:user-permissions-updated', handleUserPermUpdate);
    }, []);

    // --- FETCH ROLE PERMISSIONS FROM DB & REALTIME SYNC ---
    useEffect(() => {
        if (!user || user.role === 'SuperAdmin') {
            setPermissionsLoaded(true);
            return;
        }
        
        setPermissionsLoaded(false);
        const fetchRolePerms = () => {
            supabase
                .from('role_permissions')
                .select('page_id, allowed')
                .eq('role_name', user.role)
                .then(({ data }) => {
                    if (data && data.length > 0) {
                        const allowedSet = new Set<string>(
                            data.filter(r => r.allowed).map(r => r.page_id)
                        );
                        setDbAllowedPages(allowedSet);
                    } else {
                        setDbAllowedPages(null); // Fallback to standard defaults
                    }
                    setPermissionsLoaded(true);
                });
        };

        fetchRolePerms();

        // Subscribe to realtime role permissions changes
        const channel = supabase.channel('app-role-permissions-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'role_permissions' }, () => {
                fetchRolePerms();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.role]);

    // --- STRICT DYNAMIC ROUTE GUARD (ZERO HARDCODED EXCEPTIONS) ---
    useEffect(() => {
        if (!user || !user.role || !permissionsLoaded) return;

        const effectivePermissions = computeEffectivePermissions({
            role: user.role,
            isSuperAdmin: user.role === 'SuperAdmin',
            dbRoleAllowedPages: dbAllowedPages,
            userRoleModules: user.roleModules
        });

        const isAllowed = effectivePermissions.has('*') || effectivePermissions.has(activePage);

        if (!isAllowed) {
            console.warn(`Access Denied: ${user.role} tried to access ${activePage}. Redirecting...`);
            if (activePage === 'login') return; // Allow login page

            if (effectivePermissions.has('construction')) setActivePage('construction');
            else if (user.role === 'Operator' || user.role === 'Device') setActivePage('scanner');
            else if (user.role === 'Driver') setActivePage('delivery-driver');
            else if (effectivePermissions.has('dashboard')) setActivePage('dashboard');
            else setActivePage('profile');
        }
    }, [activePage, user, dbAllowedPages, permissionsLoaded]);

    const handleSession = async (session: Session | null) => {
        if (!session?.user) {
            setUser(null);
            setIsLoggedIn(false);
            return;
        }

        const currentUser = session.user;
        let role: UserRole = 'Operator';
        let status = 'Active';
        let name = currentUser.email?.split('@')[0] || 'User';
        let employeeId = undefined;

        try {
            // Fetch Public Profile
            const { data: profile } = await supabase
                .from('users_public')
                .select('*')
                .eq('id', currentUser.id)
                .single();

            let sysUser: any = null;
            if (profile) {
                role = (profile.role as UserRole) || 'Operator';
                status = profile.status || 'Active';
                name = profile.name || name;
                employeeId = profile.employee_id;
            } else {
                // ⚡ Fallback: try sys_users_v2 directly via auth_user_id
                // (handles cases where users_public RLS blocks the anon key read)
                const { data: fetchedSysUser } = await supabase
                    .from('sys_users_v2')
                    .select('role, status, name, employee_id, factory_id')
                    .eq('auth_user_id', currentUser.id)
                    .maybeSingle();

                sysUser = fetchedSysUser;

                if (sysUser) {
                    console.log('[Auth] Found profile via sys_users_v2 fallback for:', currentUser.email);
                    role = (sysUser.role as UserRole) || 'Operator';
                    status = sysUser.status || 'Active';
                    name = sysUser.name || name;
                    employeeId = sysUser.employee_id;
                } else {
                    // Last-resort fallback for Demo / Legacy email patterns
                    if (currentUser.email?.includes('super')) { role = 'SuperAdmin'; status = 'Active'; }
                    if (currentUser.email?.includes('admin')) { role = 'Admin'; status = 'Active'; }
                    if (currentUser.email?.includes('driver')) { role = 'Driver'; status = 'Active'; }
                    if (currentUser.email?.includes('boss')) { role = 'Manager'; status = 'Active'; }
                    if (currentUser.email?.includes('operator')) { role = 'Operator'; status = 'Active'; }
                    if (currentUser.email?.startsWith('device-')) { role = 'Device' as UserRole; status = 'Active'; }
                }
            }

            // --- SUPER ADMIN ENFORCEMENT ---
            // If employee ID is 001 or 002, FORCE SuperAdmin role regardless of DB
            if (employeeId === '001' || employeeId === '002') {
                role = 'SuperAdmin';
            }

            // 🚨 FIX: Normalize legacy 'User' role to 'Operator'
            if (role === 'User' as any) role = 'Operator';


            // 🚨 FORCE ACTIVE FOR DEMO ACCOUNTS (Override DB) 🚨
            const demoKeywords = ['admin', 'driver', 'boss', 'operator', 'demo', 'test', 'device', 'super'];
            if (demoKeywords.some(k => currentUser.email?.includes(k))) {
                status = 'Active';
            }

            // Check if profile has it, or sysUser
            const resolvedFactoryId = profile?.factory_id || sysUser?.factory_id || undefined;

            // CHECK STATUS
            if (status === 'Pending' || status === 'Rejected') {
                console.warn(`User status is ${status}. Signing out.`);
                await supabase.auth.signOut();
                setUser(null);
                setIsLoggedIn(false);
                alert(`Account is ${status}. Please contact Admin/HR.`);
                return;
            }

            // Fetch dynamic module unlocks and pin_code
            let roleModules: string[] = [];
            let resolvedPinCode: string | undefined = undefined;
            try {
                const { data: v2Data } = await supabase
                    .from('sys_users_v2')
                    .select('role_modules, pin_code')
                    .eq('auth_user_id', currentUser.id)
                    .maybeSingle();
                if (v2Data) {
                    if (v2Data.role_modules) roleModules = v2Data.role_modules;
                    if (v2Data.pin_code) resolvedPinCode = v2Data.pin_code;
                }
            } catch (e) {
                console.warn("Failed to fetch custom modules / PIN", e);
            }

            setUser({
                email: currentUser.email || '',
                name: name,
                role: role,
                uid: currentUser.id,
                employeeId: employeeId,
                gps: 'Unknown',
                status: status as any,
                loginTime: new Date().toLocaleTimeString(),
                roleModules: roleModules,
                factoryId: resolvedFactoryId,
                pinCode: resolvedPinCode
            });
            setIsLoggedIn(true);

            // Log successful Login once per session
            const currentGps = (typeof window !== 'undefined' && ((window as any).__CURRENT_GPS__ || sessionStorage.getItem('last_known_gps'))) || 'Unknown';
            const userObj = { email: currentUser.email || '', name, role: role as UserRole, uid: currentUser.id, status: status as any, loginTime: new Date().toLocaleTimeString(), gps: currentGps };
            if (!sessionStorage.getItem('hasLoggedSessionIn')) {
                logActivity(userObj, 'LOGIN', { 
                    method: 'auth_success',
                    gps: currentGps !== 'Unknown' ? currentGps : null,
                    location: resolvedFactoryId || null
                });
                sessionStorage.setItem('hasLoggedSessionIn', 'true');
            }

            // Initial Routing Logic (Force correct landing page)
            const isAppMode = window.location.search.includes('mode=app');
            if (isAppMode) {
                setActivePage('delivery-driver');
            } else if (!localStorage.getItem('lastActivePage')) {
                if (role === 'SuperAdmin') setActivePage('dashboard');
                else if (role === 'Operator' || role === 'Device') setActivePage('scanner');
                else if (role === 'Driver') setActivePage('delivery-driver');
                else if (role === 'Manager') setActivePage('order-summary');
                else if (['Admin', 'Sales', 'Finance'].includes(role)) setActivePage('construction');
                else if (role === 'HR') setActivePage('hr');
                else setActivePage('dashboard');
            }

        } catch (e) {
            console.error("Profile Fetch Error:", e);
        }
    };

    // 1. Subscribe to Firestore Data (or Load Mock Data)
    useEffect(() => {
        if (!user) return; // Only fetch data if logged in

        // DEMO/MOCK MODE: 
        // Enable for specific IDs, generic 'demo' emails, or Drivers (to simplify mobile testing)
        // Also includes 'test' in email
        // DEMO/MOCK MODE: DISABLED
        // We want to force real Supabase data for all users now.
        const isDemoUser = false;
        /* 
        const isDemoUser = user.uid === 'demo-123' ||
            user.role === 'Driver' ||
            user.email?.includes('demo') ||
            user.email?.includes('test'); 
        */

        if (isDemoUser) {
            console.log("Demo/Driver Mode: Loading Mock Data for:", user.email);
            setInventory([
                { Raw_Material_ID: 'RM-001', Material_Name: 'Resin A', Stock_Kg: 5000 },
                { Raw_Material_ID: 'RM-002', Material_Name: 'Pigment Red', Stock_Kg: 200 }
            ]);
            setJobs([
                {
                    Job_ID: 'JOB-101', customer: 'Tan Furniture', product: 'BW-50x1-CLR-2R', target: 500, produced: 500, status: 'Completed', machine: 'M01', Priority: 'High',
                    deliveryAddress: '123 Jalan Industri 5, Taiping', deliveryZone: 'North', deliveryStatus: 'Pending'
                },
                {
                    Job_ID: 'JOB-102', customer: 'KL Logistics', product: 'BW-33x1-BLK-3R', target: 200, produced: 200, status: 'Completed', machine: 'M02', Priority: 'Normal',
                    deliveryAddress: '88 Shah Alam Sek 15', deliveryZone: 'Central', deliveryStatus: 'In-Transit', driverId: 'driver-01' // Example assigned
                },
                {
                    Job_ID: 'JOB-103', customer: 'Johor Mart', product: 'BW-33x1-BLK-3R', target: 200, produced: 200, status: 'Completed', machine: 'M02', Priority: 'Normal',
                    deliveryAddress: 'JB Sentral', deliveryZone: 'South', deliveryStatus: 'Pending'
                },
                {
                    Job_ID: 'JOB-104', customer: 'Penang Tech', product: 'BW-50x1-CLR-2R', target: 100, produced: 20, status: 'Production', machine: 'M01', Priority: 'High',
                    deliveryAddress: 'Bayan Lepas FIZ', deliveryZone: 'North', deliveryStatus: 'Pending'
                }
            ]);
            return;
        }

        // --- SUPABASE MIGRATION: REALTIME DATA SYNC ---

        // 1. Inventory Sync (V2 MIGRATION)
        const fetchInventory = async () => {
            try {
                // Fetch from V2 Inventory View (Single Source of Truth)
                const { data, error } = await supabase.from('v2_inventory_view').select('*');

                if (error) throw error;

                if (data) {
                    // Map V2 Data -> Legacy Dashboard Interface
                    const mapped: InventoryItem[] = data.map((item: any) => ({
                        Raw_Material_ID: item.sku,
                        Material_Name: item.name,
                        Stock_Kg: item.current_stock, // Now comes from Ledger Sum
                        // Extra props for compatibility
                        id: item.sku, // Use SKU as ID
                        qty: item.current_stock,
                        name: item.name,
                        loc_id: item.loc_id,
                        // Export Fields
                        category: item.category,
                        status: item.status,
                        unit: item.unit
                    }));
                    setInventory(mapped);
                }
            } catch (e) {
                console.error("V2 Sync Error:", e);
            }
        };
        fetchInventory();

        const invChannel = supabase.channel('inventory-changes-v2')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_ledger_v2' }, fetchInventory)
            .subscribe();

        // 2. Logs Sync
        // 2. Logs Sync (V2 MIGRATION)
        const fetchLogs = async () => {
            // Join with sys_users_v2 if FK exists, otherwise just fetch raw
            // Try selecting operator name if possible, else just ID
            const { data, error } = await supabase
                .from('production_logs_v2')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) {
                console.error("Error fetching V2 logs:", error);
                return;
            }

            if (data) {
                const mapped: ProductionLogType[] = data.map((log: any) => ({
                    Log_ID: log.log_id,
                    Timestamp: log.created_at,
                    Job_ID: log.job_id,
                    // Resolve email/name from joined data or fallback
                    Operator_Email: log.sys_users_v2?.name || log.sys_users_v2?.email || `Op:${log.operator_id?.slice(0, 5)}`,
                    Output_Qty: Number(log.output_qty), // Ensure number
                    GPS_Coordinates: undefined, // Not in V2 yet
                    Note: log.note || undefined,
                    AI_Verification: { Verified: true, Detected_Rolls: Number(log.output_qty), Confidence: 'Manual' }
                }));
                setLogs(mapped);
            }
        };
        fetchLogs();

        const logsChannel = supabase.channel('logs-changes-v2')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'production_logs_v2' }, fetchLogs)
            .subscribe();

        // 3. Jobs Sync
        const fetchJobs = async () => {
            const { data } = await supabase.from('job_orders').select('*').order('order_index', { ascending: true });
            if (data) {
                const mapped: JobOrder[] = data.map(job => ({
                    Job_ID: job.job_id,
                    id: job.job_id, // alias
                    customer: job.customer,
                    product: job.product,
                    target: job.target_qty,
                    produced: job.produced_qty,
                    status: job.status as any,
                    machine: job.machine,
                    Priority: job.priority as any,
                    deliveryZone: job.delivery_zone as any,
                    deliveryStatus: job.delivery_status as any,
                    deliveryAddress: job.delivery_address || undefined,
                    driverId: job.driver_id || undefined,
                    orderIndex: job.order_index
                }));
                setJobs(mapped);
            }
        };
        fetchJobs();

        const jobsChannel = supabase.channel('jobs-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'job_orders' }, fetchJobs)
            .subscribe();



        return () => {
            supabase.removeChannel(invChannel);
            supabase.removeChannel(logsChannel);
            supabase.removeChannel(jobsChannel);

        };
    }, [user]);



    const handleLogin = (email: string | null, gps: string, role: string) => {
        console.log("Login callback triggered", email, gps, role);

        // Handle Device Login (Bypassing Supabase Auth)
        if (role === 'Device' && email) {
            const fakeUser: User = {
                email: email,
                name: 'Device Station',
                role: 'Device' as UserRole,
                uid: 'device-' + Date.now(),
                employeeId: undefined,
                gps: gps,
                status: 'Active',
                loginTime: new Date().toLocaleTimeString()
            };
            setUser(fakeUser);
            setIsLoggedIn(true);
            setActivePage('scanner');
            return;
        }

        // Handle Demo Login (Bypassing Supabase Auth)
        if (email?.startsWith('demo.')) {
            console.log("Demo Login Detected:", role);
            // Assign Special ID for SuperAdmin Demo
            let empId = 'DEMO-001';
            let finalRole = role as UserRole;

            if (role === 'SuperAdmin') {
                empId = '001';
            }

            const demoUser: User = {
                email: email,
                name: `${role} Demo`,
                role: finalRole,
                uid: 'demo-' + Date.now(),
                employeeId: empId,
                gps: gps,
                status: 'Active',
                loginTime: new Date().toLocaleTimeString()
            };
            setUser(demoUser);
            setIsLoggedIn(true);

            // Explicit Routing
            if (finalRole === 'SuperAdmin') setActivePage('dashboard');
            else if (role === 'Operator') setActivePage('scanner');
            else if (role === 'Driver') setActivePage('delivery-driver');
            else if (role === 'Manager') setActivePage('order-summary');
            else if (['Admin', 'HR', 'Sales', 'Finance'].includes(role)) setActivePage('construction');
            else setActivePage('dashboard');

            return;
        }

        // Check for session to be safe (though Login.tsx usually handles Supabase auth for others)
        // If we get here for non-device, check current session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                handleSession(session);
            }
        });
    };

    // handleProductionSubmit removed (Moved to ProductionControl)

    // handleUpdateJob removed (unused)

    // ... (existing imports)



    // Check for printable mode (via URL ?mode=labels)
    const isLabelMode = window.location.search.includes('mode=labels');

    if (isLabelMode) {
        return <MachineLabels />;
    }

    if (!isLoggedIn) {
        // IoT 模式：设备通过 #/production/... 访问，直接显示生产控制页（含 PIN 验证）
        if (isIoTMode) {
            return (
                <ErrorBoundary>
                    <ProductionControl user={null} jobs={[]} />
                </ErrorBoundary>
            );
        }
        if (activePage === 'register') {
            return (
                <ErrorBoundary>
                    <Register onNavigate={setActivePage} />
                </ErrorBoundary>
            );
        }
        return (
            <ErrorBoundary>
                <Login
                    onLogin={handleLogin}
                    onNavigate={setActivePage}
                />
            </ErrorBoundary>
        );
    }

    // Machine Check-In (DISABLED per user request "delete shift")
    // if (user?.role === 'Operator' && !loadingAttendance && !currentShift) {
    //     return <MachineCheckIn onCheckIn={handleClockIn} />;
    // }

    const renderContent = () => {
        switch (activePage) {
            case 'dashboard':
                return null; // <Dashboard logs={logs} inventory={inventory} jobs={jobs} machines={machines} />;
            case 'login': // Explicit case
                return null;
            case 'jobs':
                return null; // <JobOrders jobs={jobs} onCreateJob={handleCreateJob} onReorderJobs={handleReorderJobs} />;
            case 'planning':
                return null; // <ProductionPlanning jobs={jobs} onUpdateJob={handleUpdateJob} />;
            case 'production':
                return <ProductionLog logs={logs} userRole={user?.role || 'Operator'} />;
            case 'iot':
                return <IoTManagement />;
            case 'inventory':
                return <Inventory />;
            case 'livestock':
                return <LiveStock onNavigate={setActivePage} />;
            case 'stock-movement':
                return <StockMovement user={user} />;
            case 'stock-audit':
                return <StockAudit user={user} />;
            case 'audit-report':
                return <AuditReport user={user} />;
            case 'products':
            case 'product-library': // 兼容旧路由键
                return <ProductLibrary />;
            case 'recipes':
                return <YieldControl />;
            case 'delivery':
                return <DeliveryOrderManagement user={user} />;
            case 'live-fleet':
                return <LiveFleet />;
            case 'order-summary':
                return <OrderSummary user={user} />;
            case 'delivery-driver':
                return <DriverDelivery user={user} />;
            case 'delivery-history':
                return <DriverHistory user={user} />;
            case 'lorry-service':
                return <LorryService user={user} />;
            case 'maintenance':
                return <MaintenanceManagement user={user} />;
            case 'lorry-management':
                return <LorryManagement />;
            case 'dispatch':
                return null; // <Dispatch />;
            // case 'loading-dock':
            //    return <LoadingDock />;
            case 'data-v2':
                return <DataManagement />;
            case 'admin-data':
                return <DataManagement />;
            case 'scanner':
                return <ProductionControl user={user as any} jobs={jobs} onNavigate={setActivePage} />;
            case 'report-history':
                return <ReportHistory user={user as any} />;
            case 'reports':
                return <ProductionReports user={user} />;
            case 'executive-reports':
                return <ExecutiveReports user={user} />;
            case 'william-dashboard':
                return <WilliamDocumentCenter />;
            // Organization
            case 'users':
                return <HRPortal user={user} initialTab="personnel" onNavigate={setActivePage} />;
            case 'driver-management':
                return <HRPortal user={user} initialTab="personnel" initialRoleFilter="Driver" onNavigate={setActivePage} />;
            case 'hr':
                return <HRPortal user={user} onNavigate={setActivePage} />;
            case 'update-password':
                return <UpdatePassword />;
            case 'profile':
                return <Profile user={user} onNavigate={setActivePage} />;
            case 'boss-copilot':
                return <BossCoPilot currentUser={user} onNavigate={setActivePage} />;
            case 'factory-live-os':
                return <FactoryLiveOS onNavigate={setActivePage} />;
            case 'floor-plan':
                return <FloorPlan user={user} />;
            case 'operators':
                return <HRPortal user={user} initialTab="personnel" initialRoleFilter="Operator" onNavigate={setActivePage} />;
            case 'dev-log':
                return <DevLog />;
            case 'notes':
                return <Notes user={user} />;
            case 'tasks':
                return <Tasks user={user} />;
            case 'driver-leave':
            case 'leave-calendar':
                return <LeaveCalendar user={user} onNavigate={setActivePage} />;
            case 'sop-center':
                return <SOPCenter userRole={user?.role} user={user} onNavigate={setActivePage} />;
            case 'work-photos':
                return <WorkPhotoLog user={user} />;
            case 'raw_material_mobile':
                return <RawMaterialMobilePortal currentUser={user} activeFactoryId={user?.factoryId} />;
            case 'personal-report':
                return <PersonalMonthlyReport user={user} />;
            case 'machine-schedule':
                return <MachineSchedule user={user} />;
            case 'machine-labels':
                return <MachineLabels />;
            case 'activity-logs':
                return <ActivityLogs user={user} />;
            case 'data':
                return <UnderConstruction title="Access Restricted" />;
            case 'construction':
                return <UnderConstruction title="Access Restricted" />;
            default:
                return <ProductionControl user={user as any} jobs={jobs} />;
        }
    };

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            setUser(null);
            setIsLoggedIn(false);
            setIsIoTMode(false);
            setActivePage('dashboard');
            // Clear machine session & persistence
            sessionStorage.removeItem('selectedMachine');
            localStorage.removeItem('selectedMachine');
            localStorage.removeItem('device_machine_id'); // 清除 IoT 绑定
            localStorage.removeItem('lastActivePage'); // Force clean state on next login
            sessionStorage.removeItem('hasLoggedSessionIn'); // Clear login tracking flag
            
            if (user) {
                logActivity(user, 'LOGOUT', { method: 'explicit_logout' });
            }
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };

    const isAppMode = window.location.search.includes('mode=app');

    if (isAppMode) {
        return (
            <ErrorBoundary>
                <div className="h-screen w-screen flex flex-col bg-apple-bg text-apple-textMain font-sans overflow-hidden">
                    {/* Minimal App Header */}
                    <div className="shrink-0 h-14 bg-apple-bg/90 backdrop-blur-md border-b border-apple-border flex justify-between items-center px-4 z-50">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded flex items-center justify-center font-bold text-white bg-green-600 text-xs shadow-md">
                                P
                            </div>
                            <span className="font-bold text-sm tracking-tight text-white">PackSecure App</span>
                        </div>
                        <button 
                            onClick={handleLogout}
                            className="text-xs font-bold text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                        >
                            Log Keluar
                        </button>
                    </div>
                    {/* Main Content Area */}
                    <div className="flex-1 overflow-y-auto relative custom-scrollbar bg-[#09090b]">
                        {renderContent()}
                    </div>
                </div>
            </ErrorBoundary>
        );
    }

    return (
        <ErrorBoundary>
            <Layout activePage={activePage} setActivePage={setActivePage} userRole={user?.role} user={user} onLogout={handleLogout}>
                {renderContent()}
                <AIAgentWidget user={user} onNavigate={setActivePage} />

            </Layout >
        </ErrorBoundary>
    );
}

export default App;
