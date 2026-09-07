import React from 'react';
import {
    LayoutDashboard,
    ClipboardList,
    BarChart3,
    Boxes,
    User,
    Users,
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
    Printer,
    FlaskConical,
    Bot,
    FileCode,
} from 'lucide-react';

export type UserRole = 
    | 'SuperAdmin' 
    | 'Admin' 
    | 'Manager' 
    | 'LogisticsCoordinator' 
    | 'HR' 
    | 'Operator' 
    | 'Driver' 
    | 'Sales' 
    | 'Finance'
    | 'Device';

export type ModuleGroupId = 
    | 'executive'
    | 'operations'
    | 'inventory'
    | 'logistics'
    | 'organization'
    | 'productivity';

export interface ModuleGroupDefinition {
    id: ModuleGroupId;
    title: string;
    titleEn: string;
    description: string;
    order: number;
}

export interface ModuleDefinition {
    id: string;
    label: string;
    labelEn: string;
    group: ModuleGroupId;
    icon: React.ComponentType<{ size?: number | string; className?: string }>;
    defaultRoles: UserRole[];
    isCore?: boolean; // Essential pages available to all authenticated users
    badgeKey?: 'tasks';
    description?: string;
    hiddenFromNav?: boolean; // If true, module is hidden from main sidebar navigation (e.g. legacy alias or sub-route)
}

export const MODULE_GROUPS: ModuleGroupDefinition[] = [
    { id: 'executive', title: '管理决策舱', titleEn: 'Executive Suite', description: '管理驾驶舱与决策支持', order: 1 },
    { id: 'operations', title: '车间作业', titleEn: 'Operations', description: '车间生产、工位与排产调度', order: 2 },
    { id: 'inventory', title: '库存与物料', titleEn: 'Inventory & BOM', description: '原材料、成品、物料流水与盘点', order: 3 },
    { id: 'logistics', title: '物流配送', titleEn: 'Logistics', description: '车辆、派车运输与发货履约', order: 4 },
    { id: 'organization', title: '人事与系统', titleEn: 'Organization', description: '人员、考勤服务台、审批与报表', order: 5 },
    { id: 'productivity', title: '日常协同', titleEn: 'Productivity', description: 'SOP协同、待办与日常工具', order: 6 }
];

export const MODULE_REGISTRY: ModuleDefinition[] = [
    // ── EXECUTIVE SUITE ──
    {
        id: 'boss-copilot',
        label: 'Boss 决策大脑',
        labelEn: 'Boss Co-Pilot',
        group: 'executive',
        icon: Bot,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager'],
        description: '高管 AI 决策助理与宏观分析'
    },
    {
        id: 'factory-live-os',
        label: '全厂实时大屏',
        labelEn: 'Factory Live OS',
        group: 'executive',
        icon: LayoutDashboard,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager'],
        description: '全厂实时运行状态大屏'
    },
    {
        id: 'william-dashboard',
        label: "William 经营看板",
        labelEn: "William's Dashboard",
        group: 'executive',
        icon: FileText,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager'],
        description: '运营分析与特定经营看板'
    },
    {
        id: 'data-v2',
        label: '主数据底座',
        labelEn: 'Data Command',
        group: 'executive',
        icon: Database,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager'],
        description: '底层主数据与基础库维护'
    },

    // ── OPERATIONS ──
    {
        id: 'staff-status',
        label: '员工状态与交班核准',
        labelEn: 'Staff Status & Sign-off',
        group: 'operations',
        icon: ClipboardCheck,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager'],
        description: '全员工作状态监控、工时核验与交班审核打钩'
    },
    {
        id: 'scanner',
        label: '车间生产工作区',
        labelEn: 'Production Workspace',
        group: 'operations',
        icon: Scan,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager', 'Operator'],
        description: '车间机台生产扫码与实时记件'
    },
    {
        id: 'raw_material_mobile',
        label: '多螺杆与混料配方',
        labelEn: 'Multi-Screw & Material Mixing',
        group: 'operations',
        icon: FlaskConical,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager', 'Operator'],
        isCore: true,
        description: '多螺杆与原辅材料混料配比'
    },
    {
        id: 'livestock',
        label: '成品实时库存',
        labelEn: 'Live Stock',
        group: 'operations',
        icon: BarChart3,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager', 'LogisticsCoordinator'],
        description: '成品实时入库与现货仓位看板'
    },
    {
        id: 'recipes',
        label: '工艺配方与良率',
        labelEn: 'Yield & AI Learning',
        group: 'operations',
        icon: Activity,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager'],
        description: '工艺配方良率与 AI 调优'
    },
    {
        id: 'machine-schedule',
        label: '机台排产日历',
        labelEn: 'Machine Schedule',
        group: 'operations',
        icon: Calendar,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager'],
        description: '机台排产计划与工单日历'
    },
    {
        id: 'machine-labels',
        label: '机台二维码标签',
        labelEn: 'Machine QR Labels',
        group: 'operations',
        icon: Printer,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager'],
        description: '机台专属二维码与物料标签打印'
    },
    {
        id: 'floor-plan',
        label: '车间布局平面图',
        labelEn: 'Floor Plan',
        group: 'operations',
        icon: LayoutDashboard,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager'],
        description: '车间物理平面布局与动线图'
    },

    // ── INVENTORY & BOM ──
    {
        id: 'stock-movement',
        label: '物料出入流水',
        labelEn: 'Stock Movement',
        group: 'inventory',
        icon: ArrowUpDown,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager'],
        description: '物料库存调拨、入库、出库流水'
    },
    {
        id: 'stock-audit',
        label: '实物盘点核对',
        labelEn: 'Stock Audit',
        group: 'inventory',
        icon: ClipboardCheck,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager'],
        description: '车间实物盘点核对与扫码盲盘'
    },
    {
        id: 'inventory',
        label: '全局库存总览',
        labelEn: 'Global Inventory',
        group: 'inventory',
        icon: Boxes,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager'],
        description: '原料库、半成品与全局库存总览'
    },
    {
        id: 'products',
        label: '标准物料成品库',
        labelEn: 'Product Library',
        group: 'inventory',
        icon: Package,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager', 'LogisticsCoordinator'],
        description: '标准物料与成品产品库'
    },
    {
        id: 'audit-report',
        label: '盘点审计报告',
        labelEn: 'Audit Report',
        group: 'inventory',
        icon: FileBarChart,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager'],
        description: '库存盘点损益与审计历史'
    },

    // ── LOGISTICS ──
    {
        id: 'delivery',
        label: '出车调度管理',
        labelEn: 'Trip Management',
        group: 'logistics',
        icon: Truck,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager', 'LogisticsCoordinator'],
        description: '发货出车、线路规划与司机派单'
    },
    {
        id: 'delivery-driver',
        label: '司机送货任务',
        labelEn: 'My Deliveries',
        group: 'logistics',
        icon: Package,
        defaultRoles: ['Driver'],
        description: '司机专属发车签到、导航与送达拍照'
    },
    {
        id: 'delivery-history',
        label: '出车历史记录',
        labelEn: 'Delivery History',
        group: 'logistics',
        icon: ClipboardList,
        defaultRoles: ['Driver'],
        description: '司机历史趟数与出车津贴明细'
    },
    {
        id: 'order-summary',
        label: '每日发货备货',
        labelEn: 'Daily Prep',
        group: 'logistics',
        icon: FileBarChart,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager', 'LogisticsCoordinator', 'Operator'],
        description: '每日发货备货准备与配货清单'
    },
    {
        id: 'maintenance',
        label: '设备维保管理',
        labelEn: 'Maintenance Control',
        group: 'logistics',
        icon: Wrench,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager', 'LogisticsCoordinator'],
        description: '设备维保、保养巡检与报修'
    },
    {
        id: 'lorry-management',
        label: '货车车队档案',
        labelEn: 'Lorry Fleet',
        group: 'logistics',
        icon: Truck,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager'],
        description: '货车车队档案、路税与保险'
    },
    {
        id: 'lorry-service',
        label: '车辆维保报修',
        labelEn: 'Lorry Service',
        group: 'logistics',
        icon: Truck,
        defaultRoles: ['Driver'],
        description: '司机车辆维保报修登记'
    },
    {
        id: 'driver-management',
        label: '司机运力档案',
        labelEn: 'Driver Management',
        group: 'logistics',
        icon: Users,
        defaultRoles: ['LogisticsCoordinator', 'SuperAdmin', 'Admin', 'Manager'],
        description: '司机运力档案与出车状态追踪'
    },
    {
        id: 'production',
        label: '生产班次日志',
        labelEn: 'Production Logs',
        group: 'logistics',
        icon: Database,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager'],
        description: '生产班次原始日志追踪'
    },
    {
        id: 'report-history',
        label: '历史发货报告',
        labelEn: 'Report History',
        group: 'logistics',
        icon: FileText,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager'],
        description: '历史发货与交付报告归档'
    },

    // ── ORGANIZATION ──
    {
        id: 'leave-calendar',
        label: '员工服务台 / 考勤',
        labelEn: 'Staff Hub',
        group: 'organization',
        icon: Calendar,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager', 'HR', 'Driver', 'Operator'],
        description: '员工综合服务台、请假日历与排班'
    },
    {
        id: 'driver-leave',
        label: '员工请假申请',
        labelEn: 'Apply Leave',
        group: 'organization',
        icon: Calendar,
        defaultRoles: ['Driver', 'HR'],
        description: '快捷员工请假申请单 (指向 Staff Hub 请假中心)',
        hiddenFromNav: true
    },
    {
        id: 'hr',
        label: '人事与权限中心',
        labelEn: 'HR Control Center',
        group: 'organization',
        icon: Users,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager', 'HR'],
        description: '人事档案、薪酬核算与 RBAC 权限中心'
    },
    {
        id: 'reports',
        label: '管理层综合报表',
        labelEn: 'Executive Reports',
        group: 'organization',
        icon: FileBarChart,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager', 'LogisticsCoordinator'],
        description: '管理层经营综合报表与导出'
    },
    {
        id: 'iot',
        label: '物联网硬件设置',
        labelEn: 'IOT SETTINGS',
        group: 'organization',
        icon: Cpu,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager'],
        description: '车间传感器与物联硬件接口'
    },
    {
        id: 'dev-log',
        label: '系统开发日志',
        labelEn: 'Dev Log',
        group: 'organization',
        icon: Activity,
        defaultRoles: ['SuperAdmin', 'Admin'],
        description: '系统版本迭代与开发日志'
    },
    {
        id: 'system-docs',
        label: '系统文档中心',
        labelEn: 'System Docs',
        group: 'organization',
        icon: FileCode,
        defaultRoles: ['SuperAdmin', 'Admin'],
        description: '在线查看与编辑系统 Markdown 文档 (README, 业务真理库)'
    },
    {
        id: 'activity-logs',
        label: '系统操作日志',
        labelEn: 'Activity Logs',
        group: 'organization',
        icon: Activity,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager', 'HR', 'Driver', 'Operator'],
        description: '系统关键业务操作审计追溯'
    },
    {
        id: 'personal-report',
        label: '个人出勤月报',
        labelEn: 'My Monthly Report',
        group: 'organization',
        icon: FileText,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager', 'HR', 'Driver', 'Operator'],
        description: '员工个人月度出勤、工时与趟数月报'
    },

    // ── PRODUCTIVITY ──
    {
        id: 'sop-center',
        label: 'SOP 标准指引',
        labelEn: 'SOP Center',
        group: 'productivity',
        icon: BookOpen,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager', 'HR', 'Driver', 'Operator'],
        description: '全流程岗位标准作业指引'
    },
    {
        id: 'work-photos',
        label: '现场作业拍照',
        labelEn: 'Work Photos',
        group: 'productivity',
        icon: Camera,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager', 'HR', 'Driver', 'Operator'],
        description: '📸 车间机台与现场作业拍照存档'
    },
    {
        id: 'notes',
        label: '日常工作便签',
        labelEn: 'Notes',
        group: 'productivity',
        icon: FileText,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager', 'HR', 'Driver', 'Operator'],
        description: '日常工作速记便签'
    },
    {
        id: 'tasks',
        label: '协同任务看板',
        labelEn: 'Tasks',
        group: 'productivity',
        icon: ClipboardList,
        defaultRoles: ['SuperAdmin', 'Admin', 'Manager', 'HR', 'Driver', 'Operator'],
        badgeKey: 'tasks',
        description: '协同任务指派与跟踪'
    }
];

export const ESSENTIAL_PAGE_IDS = [
    'profile',
    'login',
    'construction',
    'dashboard',
    'raw_material_mobile'
] as const;

/**
 * Generates default permission lookup map by role.
 */
export function getDefaultRolePermissionsMap(): Record<string, Set<string>> {
    const map: Record<string, Set<string>> = {};
    const roles: UserRole[] = [
        'SuperAdmin', 'Admin', 'Manager', 'LogisticsCoordinator', 
        'HR', 'Operator', 'Driver', 'Sales', 'Finance', 'Device'
    ];

    roles.forEach(role => {
        if (role === 'SuperAdmin') {
            map[role] = new Set(MODULE_REGISTRY.map(m => m.id));
        } else {
            const allowed = MODULE_REGISTRY
                .filter(m => m.defaultRoles.includes(role))
                .map(m => m.id);
            map[role] = new Set(allowed);
        }
    });

    return map;
}

/**
 * Find module by ID
 */
export function getModuleById(id: string): ModuleDefinition | undefined {
    return MODULE_REGISTRY.find(m => m.id === id);
}

/**
 * Check if a user has driver dispatch capability (without hardcoding any names or emails)
 */
export function isUserDriverCapable(user?: { role?: string; roleModules?: string[]; role_modules?: string[] }): boolean {
    if (!user) return false;
    if (user.role === 'Driver') return true;
    const modules = user.roleModules || user.role_modules || [];
    return modules.includes('delivery-driver');
}
