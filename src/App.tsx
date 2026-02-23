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
import ProductLibrary from './pages/ProductLibrary';
import DeliveryOrderManagement from './pages/DeliveryOrderManagement';
import DriverDelivery from './pages/DriverDelivery';
import DriverHistory from './pages/DriverHistory';
import DriverLeave from './pages/DriverLeave';
import LorryService from './pages/LorryService';
import MaintenanceManagement from './pages/MaintenanceManagement';
import LorryManagement from './pages/LorryManagement';
// import Dispatch from './pages/Dispatch';
import LoadingDock from './pages/LoadingDock';
import MachineLabels from './pages/MachineLabels';
import ExecutiveReports from './pages/ExecutiveReports';
import DataManagement from './pages/DataManagement';
import ReportHistory from './pages/ReportHistory';
import UnderConstruction from './pages/UnderConstruction';
import ClaimsManagement from './pages/ClaimsManagement';
import UpdatePassword from './pages/UpdatePassword';
import OrderSummary from './pages/OrderSummary'; // New Page
// import CustomerImport from './pages/CustomerImport'; // Added Import Page
// import UniversalIntake from './pages/UniversalIntake';
// import SimpleStock from './pages/SimpleStock';
import UserManagement from './pages/UserManagement';
import DriverManagement from './pages/DriverManagement';
import HRPortal from './pages/HRPortal';
import IoTManagement from './pages/IoTManagement';
import Notes from './pages/Notes';
import Tasks from './pages/Tasks';
import FactoryLiveOS from './pages/FactoryLiveOS';
import StockMovement from './pages/StockMovement';

import { User, UserRole, InventoryItem, ProductionLog as ProductionLogType, JobOrder } from './types';
import AIAgentWidget from './components/AIAgentWidget';

import { supabase } from './services/supabase';
import { Session } from '@supabase/supabase-js';

// --- CONFIGURATION ---




function App() {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [user, setUser] = useState<User | null>(null);
    const [activePage, setActivePage] = useState<string>(() => {
        // Kiosk mode: if this device is bound to a machine, always start on production screen
        if (localStorage.getItem('device_machine_id')) return 'scanner';
        return localStorage.getItem('lastActivePage') || 'factory-live-os';
    });

    // Persist activePage
    useEffect(() => {
        localStorage.setItem('lastActivePage', activePage);
    }, [activePage]);

    // Global State (Synced with Firestore)
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [logs, setLogs] = useState<ProductionLogType[]>([]);
    const [jobs, setJobs] = useState<JobOrder[]>([]);


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
                    sessionStorage.setItem('selectedMachine', machineId);
                    // Persist permanently so bookmark / home-screen shortcut auto-binds on every visit
                    localStorage.setItem('device_machine_id', machineId);
                    setActivePage('scanner');
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

    // --- STRICT ROUTE GUARD ---
    useEffect(() => {
        if (!user || !user.role) return;

        const role = user.role;
        // Define allowable pages per role
        const allowedPages: Record<string, string[]> = {
            'SuperAdmin': ['*'], // The Only One with Full Access
            'Admin': ['profile', 'construction', 'factory-live-os', 'dashboard', 'data-v2', 'customer-import', 'universal-intake', 'scanner', 'jobs', 'livestock', 'inventory', 'recipes', 'products', 'delivery', 'order-summary', 'dispatch', 'loading-dock', 'production', 'report-history', 'users', 'hr', 'claims', 'simple-stock', 'maintenance', 'lorry-management', 'iot', 'driver-management'],
            'Manager': ['profile', 'construction', 'factory-live-os', 'dashboard', 'data-v2', 'customer-import', 'universal-intake', 'scanner', 'jobs', 'livestock', 'inventory', 'recipes', 'products', 'delivery', 'order-summary', 'dispatch', 'loading-dock', 'production', 'report-history', 'hr', 'claims', 'simple-stock', 'maintenance', 'lorry-management', 'iot', 'driver-management'],
            'Driver': ['delivery-driver', 'delivery-history', 'driver-leave', 'lorry-service', 'claims', 'profile'],
            'Operator': ['scanner', 'profile'],
            'Device': ['scanner'],
            'HR': ['profile', 'construction'],
            'Sales': ['profile', 'construction'],
            'Finance': ['profile', 'construction']
        };

        let allowed = allowedPages[role] || [];

        if (user.employeeId === '009') {
            allowed = ['order-summary', 'maintenance', 'profile'];
        }

        // --- SPECIAL USER OVERRIDE (Vivian) ---
        if (user.email === 'diyadmin1111@gmail.com') {
            allowed = [...allowed, 'order-summary', 'driver-management'];
        }

        const isAllowed = allowed.includes('*') || allowed.includes(activePage);

        if (!isAllowed) {
            console.warn(`Access Denied: ${role} tried to access ${activePage}. Redirecting...`);
            if (activePage === 'login') return; // Allow login page

            if (user.employeeId === '009') setActivePage('order-summary'); // Special redirect
            else if (allowed.includes('construction')) setActivePage('construction');
            else if (role === 'Operator' || role === 'Device') setActivePage('scanner');
            else if (role === 'Driver') setActivePage('delivery-driver');
            else setActivePage('login');
        }
    }, [activePage, user]);

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

            if (profile) {
                role = (profile.role as UserRole) || 'Operator';
                status = profile.status || 'Active';
                name = profile.name || name;
                employeeId = profile.employee_id;
            } else {
                // Fallback for Demo / Legacy
                if (currentUser.email?.includes('super')) { role = 'SuperAdmin'; status = 'Active'; }
                if (currentUser.email?.includes('admin')) { role = 'Admin'; status = 'Active'; }
                if (currentUser.email?.includes('driver')) { role = 'Driver'; status = 'Active'; }
                if (currentUser.email?.includes('boss')) { role = 'Manager'; status = 'Active'; }
                if (currentUser.email?.includes('operator')) { role = 'Operator'; status = 'Active'; }
                // Device detection via email pattern if not set in profile
                if (currentUser.email?.startsWith('device-')) { role = 'Device' as UserRole; status = 'Active'; }
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

            // CHECK STATUS
            if (status === 'Pending' || status === 'Rejected') {
                console.warn(`User status is ${status}. Signing out.`);
                await supabase.auth.signOut();
                setUser(null);
                setIsLoggedIn(false);
                alert(`Account is ${status}. Please contact Admin/HR.`);
                return;
            }

            setUser({
                email: currentUser.email || '',
                name: name,
                role: role,
                uid: currentUser.id,
                employeeId: employeeId,
                gps: 'Unknown',
                status: status as any,
                loginTime: new Date().toLocaleTimeString()
            });
            setIsLoggedIn(true);

            // Initial Routing Logic (Force correct landing page)
            if (!localStorage.getItem('lastActivePage')) {
                if (employeeId === '009') setActivePage('order-summary');
                else if (role === 'SuperAdmin') setActivePage('dashboard');
                else if (role === 'Operator' || role === 'Device') setActivePage('scanner');
                else if (role === 'Driver') setActivePage('delivery-driver');
                else if (['Admin', 'Manager', 'HR', 'Sales', 'Finance'].includes(role)) setActivePage('construction');
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
            else if (['Admin', 'Manager', 'HR', 'Sales', 'Finance'].includes(role)) setActivePage('construction');
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
                return <Inventory inventory={inventory} />;
            case 'livestock':
                return <LiveStock />;
            case 'stock-movement':
                return <StockMovement />;
            case 'recipes':
                return null; // <RecipeManager />;
            case 'products':
                return <ProductLibrary />;
            case 'delivery':
                return <DeliveryOrderManagement />;
            case 'order-summary':
                return <OrderSummary user={user} />;
            case 'delivery-driver':
                return <DriverDelivery user={user} />;
            case 'delivery-history':
                return <DriverHistory user={user} />;
            case 'driver-leave':
                return <DriverLeave user={user} />;
            case 'lorry-service':
                return <LorryService user={user} />;
            case 'maintenance':
                return <MaintenanceManagement user={user} />;
            case 'lorry-management':
                return <LorryManagement />;
            case 'dispatch':
                return null; // <Dispatch />;
            case 'loading-dock':
                return <LoadingDock />;
            case 'data-v2':
                return <DataManagement />;
            case 'admin-data':
                return <DataManagement />;
            case 'scanner':
                return <ProductionControl user={user as any} jobs={jobs} />;
            case 'report-history':
                return <ReportHistory user={user as any} />;
            case 'executive-reports':
                return <ExecutiveReports user={user} />;
            // Organization
            case 'users':
                return <UserManagement currentUser={user} />;
            case 'driver-management':
                return <DriverManagement currentUser={user} />;
            case 'hr':
                return <HRPortal />;
            case 'claims':
                return <ClaimsManagement user={user} />;
            case 'update-password':
                return <UpdatePassword />;
            case 'factory-live-os':
                return <FactoryLiveOS />;
            case 'notes':
                return <Notes user={user} />;
            case 'tasks':
                return <Tasks user={user} />;

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
            setActivePage('dashboard');
            // Clear machine session & persistence
            sessionStorage.removeItem('selectedMachine');
            localStorage.removeItem('selectedMachine');
            localStorage.removeItem('lastActivePage'); // Force clean state on next login
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };

    return (
        <ErrorBoundary>
            <Layout activePage={activePage} setActivePage={setActivePage} userRole={user?.role} user={user} onLogout={handleLogout}>
                {renderContent()}
                <AIAgentWidget />

            </Layout >
        </ErrorBoundary>
    );
}

export default App;
