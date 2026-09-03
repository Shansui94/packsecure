import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import * as XLSX from 'xlsx';
import {
    Activity,
    Shield,
    User as UserIcon,
    Clock,
    MapPin,
    Search,
    Filter,
    Download,
    RefreshCw,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Info,
    ChevronRight,
    ChevronLeft,
    ChevronDown,
    ChevronUp,
    Copy,
    Check,
    Smartphone,
    Monitor,
    Tablet,
    Calendar,
    Sparkles,
    TrendingUp,
    BarChart3,
    X,
    Truck,
    Factory,
    Layers,
    UserCheck,
    Lock,
    MousePointer,
    Eye,
    SlidersHorizontal,
    ArrowRightLeft,
    Camera,
    Image as ImageIcon,
    ExternalLink,
    Package,
    Navigation,
    ZoomIn
} from 'lucide-react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid
} from 'recharts';

interface ActivityLogRaw {
    id: string;
    user_id: string;
    email: string;
    name: string;
    role: string;
    action: string;
    details: any;
    created_at: string;
}

export type ActionCategory = 
    | 'PRODUCTION' 
    | 'DELIVERY' 
    | 'DISPATCH'
    | 'MATERIAL' 
    | 'HR' 
    | 'AUTH' 
    | 'ADMIN' 
    | 'BUTTON_CLICK' 
    | 'PAGE_VIEW' 
    | 'ERROR'
    | 'OTHER';

export interface AuditMetadataContext {
    driverLorryMap: Record<string, { plate: string; status?: string }>;
    userMetadataMap: Record<string, { baseLocation?: string; employeeId?: string; role?: string }>;
}

export interface Parsed5W1HLog {
    id: string;
    raw: ActivityLogRaw;
    // Who
    who: {
        id: string;
        name: string;
        email: string;
        role: string;
        factory?: string;
        lorryPlate?: string;
        employeeId?: string;
    };
    // What
    what: {
        category: ActionCategory;
        actionName: string;
        rawAction: string;
        target?: string;
        isBusinessAction: boolean;
        totalQtySummary?: string;
        legacyHint?: string;
    };
    // Where
    where: {
        moduleName: string;
        rawModule: string;
        location?: string;
        gps?: { lat: number; lng: number } | string | null;
        address?: string | null;
        mapsUrl?: string | null;
        deviceType: 'Mobile' | 'Tablet' | 'Desktop' | 'Unknown';
        deviceScreen?: string;
        elementId?: string;
    };
    // When
    when: {
        raw: string;
        formattedDate: string;
        formattedTime: string;
        relativeTime: string;
        hourKey: string;
        shiftInfo: {
            name: string;
            type: 'early' | 'normal' | 'late' | 'night';
            tagClass: string;
            description: string;
        };
    };
    // Result
    result: {
        status: 'SUCCESS' | 'FAILED' | 'WARNING' | 'INFO';
        summary: string;
        photos: string[];
        items?: { 
            name?: string; 
            sku?: string; 
            quantity?: number | string; 
            qty?: number | string; 
            confirmedQty?: number | string; 
            unit?: string; 
            oldQty?: number | string;
            remark?: string;
        }[];
        changes?: { before?: any; after?: any } | null;
        error?: string;
        isAnomaly: boolean;
        hasMissingProofAlert?: boolean;
        missingProofMessage?: string;
    };
}

interface ActivityLogsProps {
    user: User | null;
}

// Complete system modules human-readable dictionary
const MODULE_NAMES: Record<string, string> = {
    'delivery': '送货调度中心 (Trip & Delivery Orders)',
    'delivery-driver': '司机移动配送端 (Driver Delivery)',
    'delivery-history': '送货历史记录 (Delivery History)',
    'lorry-service': '货车维保服务 (Lorry Service)',
    'lorry-management': '车队货车管理 (Lorry Fleet)',
    'live-fleet': '车队实时状态 (Live Fleet)',
    'order-summary': '工单汇总总览 (Order Summary)',
    'products': '产品资料库 (Product Library)',
    'product-library': '产品资料库 (Product Library)',
    'inventory': '物料库存中心 (Inventory)',
    'simple-stock': '简易库存盘点 (Simple Stock)',
    'livestock': '动态实时库存 (Live Stock)',
    'stock-movement': '库存出入流水 (Stock Movement)',
    'stock-audit': '库存盘点对账 (Stock Audit)',
    'audit-report': '审计核对报告 (Audit Report)',
    'production': '车间生产日志 (Production Log)',
    'production-control': '车间生产控制台 (Production Control)',
    'machine-schedule': '机台调度排产 (Machine Schedule)',
    'machine-labels': '机台条码标签 (Machine Labels)',
    'raw_material_mobile': '物料移动工位 (Raw Material Mobile)',
    'scanner': '扫码核销终端 (QR Scanner)',
    'sop-center': 'SOP 标准中心 (SOP Center)',
    'leave-calendar': '请假排班中心 (Leave Calendar)',
    'driver-leave': '司机请假申请 (Driver Leave)',
    'hr': '人事与员工管理 (HR Portal)',
    'users': '系统用户管理 (Users)',
    'users-manage': '员工与权限配置 (User Permissions)',
    'operators': '机台操作员工时 (Operators)',
    'driver-management': '司机档案管理 (Driver Management)',
    'claims': '费用报销管理 (Claims)',
    'notes': '车间协作备忘 (Notes)',
    'tasks': '任务协作清单 (Tasks)',
    'work-photos': '工作现场拍照 (Work Photos)',
    'personal-report': '个人月度报表 (Personal Monthly Report)',
    'executive-reports': '高管决策报表 (Executive Reports)',
    'reports': '综合业务报表 (Reports)',
    'report-history': '历史导出记录 (Report History)',
    'dashboard': '数字指挥舱 (Command Deck)',
    'factory-live-os': '工厂数字大屏 (Factory Live OS)',
    'data-v2': '数据命令中心 (Data Command)',
    'iot': 'IoT 设备管理 (IoT Management)',
    'dev-log': '系统开发日志 (Dev Log)',
    'activity-logs': '5W1H 活动审计日志 (Activity Logs)',
    'login': '身份认证中心 (Auth Gateway)',
    'profile': '个人资料中心 (User Profile)',
    'maintenance': '设备维保管理 (Maintenance)',
    'floor-plan': '工厂平面图 (Floor Plan)'
};

// Relative time helper in Chinese
function getRelativeTime(timestamp: string): string {
    const now = new Date().getTime();
    const target = new Date(timestamp).getTime();
    const diff = Math.floor((now - target) / 1000);

    if (isNaN(diff)) return timestamp;
    if (diff < 10) return '刚刚';
    if (diff < 60) return `${diff} 秒前`;
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
    
    return new Date(timestamp).toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Parse raw activity log to 5W1H structured format
function parse5W1HLog(raw: ActivityLogRaw, metadata?: AuditMetadataContext): Parsed5W1HLog {
    const details = raw.details || {};
    const actionUpper = (raw.action || '').toUpperCase();
    const rawBtn = (details.button_text || details.element_id || '').trim();
    const btnUpper = rawBtn.toUpperCase();
    const modalTitle = details.modal_title || '';
    const rawModule = details.module || details.page || (actionUpper === 'LOGIN' || actionUpper === 'LOGOUT' ? 'login' : 'System');
    const moduleName = MODULE_NAMES[rawModule] || (rawModule === 'System' || rawModule === '/' ? '系统控制台 (System)' : rawModule);
    const pageLower = (details.page || details.module || '').toLowerCase();

    // 1. Who - Enriched with dual-insurance metadata fallback
    const rawUserId = raw.user_id || '';
    const rawUserNameKey = (raw.name || '').toLowerCase().trim();
    const userMeta = (rawUserId && metadata?.userMetadataMap?.[rawUserId]) 
        || (rawUserNameKey && metadata?.userMetadataMap?.[rawUserNameKey]) 
        || undefined;
    const lorryInfo = (rawUserId && metadata?.driverLorryMap?.[rawUserId]) 
        || (rawUserNameKey && metadata?.driverLorryMap?.[rawUserNameKey]) 
        || undefined;

    const whoRole = raw.role || userMeta?.role || 'User';
    const who = {
        id: raw.user_id || 'unknown',
        name: raw.name || raw.email?.split('@')[0] || 'Unknown User',
        email: raw.email || 'N/A',
        role: whoRole,
        employeeId: details.employee_id || userMeta?.employeeId || undefined,
        factory: details.factory_id || details.factory || details.location || userMeta?.baseLocation || undefined,
        lorryPlate: details.lorry_plate || details.plate_number || lorryInfo?.plate || undefined
    };

    // 2. What - Intelligent Category & Action Determination
    let category: ActionCategory = 'OTHER';
    let actionName = raw.action;
    let isBusinessAction = false;
    let target = details.target || undefined;
    let legacyHint: string | undefined = undefined;

    const isDriverRole = (raw.role || '').toLowerCase() === 'driver';
    const isDriverMobile = pageLower === 'delivery-driver' || pageLower.includes('driver');
    const isOfficeDispatch = (pageLower === 'delivery' || pageLower.includes('trip') || pageLower.includes('order-summary') || rawModule.includes('调度')) && !isDriverRole;

    if (actionUpper.includes('ERROR') || actionUpper.includes('FAIL') || details.status === 'FAILED') {
        category = 'ERROR';
        actionName = '系统异常 / 报错';
        isBusinessAction = true;
    } else if (actionUpper === 'CREATE_DELIVERY_ORDER') {
        category = 'DISPATCH';
        isBusinessAction = true;
        actionName = '编制并创建送货单 (Create DO)';
        if (!target && details.orderNumber) target = `DO #${details.orderNumber} - ${details.customer || ''}`;
    } else if (actionUpper === 'UPDATE_DELIVERY_ORDER') {
        category = 'DISPATCH';
        isBusinessAction = true;
        actionName = '修改并保存送货单 (Update DO)';
        if (!target && details.orderNumber) target = `DO #${details.orderNumber} - ${details.customer || ''}`;
    } else if (actionUpper === 'CANCEL_DELIVERY_ORDER') {
        category = 'DISPATCH';
        isBusinessAction = true;
        actionName = '作废/取消送货单 (Cancel DO)';
        if (!target && details.orderNumber) target = `DO #${details.orderNumber}`;
    } else if (actionUpper === 'RESTORE_DELIVERY_ORDER') {
        category = 'DISPATCH';
        isBusinessAction = true;
        actionName = '恢复送货单状态 (Restore DO)';
        if (!target && details.orderNumber) target = `DO #${details.orderNumber}`;
    } else if (actionUpper === 'DRIVER_CONFIRM_DROP_POINT') {
        category = 'DELIVERY';
        isBusinessAction = true;
        actionName = '送货点签收完成 (POD Confirm)';
        if (!target && details.orderNumber) target = `工单 #${details.orderNumber}`;
    } else if (actionUpper === 'DRIVER_COMPLETE_TRIP') {
        category = 'DELIVERY';
        isBusinessAction = true;
        actionName = '完成全部送货行程 (Trip Complete)';
    } else if (actionUpper === 'LEAVE_SUBMIT') {
        category = 'HR';
        isBusinessAction = true;
        actionName = '提交请假申请 (Submit Leave)';
    } else if (actionUpper === 'LEAVE_APPROVE') {
        category = 'HR';
        isBusinessAction = true;
        actionName = '审批请假通过 (Approve Leave)';
    } else if (actionUpper === 'LEAVE_REJECT') {
        category = 'HR';
        isBusinessAction = true;
        actionName = '拒绝请假申请 (Reject Leave)';
    } else if (actionUpper === 'LEAVE_REVOKE') {
        category = 'HR';
        isBusinessAction = true;
        actionName = '撤销请假审批 (Revoke Leave)';
    } else if (actionUpper === 'USER_APPROVE_REGISTRATION') {
        category = 'ADMIN';
        isBusinessAction = true;
        actionName = '审批员工注册 (Approve User)';
    } else if (actionUpper === 'USER_REJECT_REGISTRATION') {
        category = 'ADMIN';
        isBusinessAction = true;
        actionName = '拒绝员工注册 (Reject User)';
    } else if (actionUpper === 'USER_CREATE') {
        category = 'ADMIN';
        isBusinessAction = true;
        actionName = '新建员工档案 (Create User)';
    } else if (actionUpper === 'USER_UPDATE') {
        category = 'ADMIN';
        isBusinessAction = true;
        actionName = '修改员工资料/角色 (Update User)';
    } else if (actionUpper === 'OPERATOR_MIX_MATERIAL_SUBMIT') {
        category = 'PRODUCTION';
        isBusinessAction = true;
        actionName = '提交机台混料配方 (Material Mix)';
    } else if (actionUpper === 'ADD_MATERIAL_ITEM') {
        category = 'PRODUCTION';
        isBusinessAction = true;
        actionName = '添加机台物料 (Add Material)';
    } else if (actionUpper === 'DELETE_MATERIAL_ITEM') {
        category = 'PRODUCTION';
        isBusinessAction = true;
        actionName = '删除物料条目 (Delete Material)';
    } else if (actionUpper === 'LOGIN' || actionUpper === 'LOGOUT' || actionUpper.includes('AUTH')) {
        category = 'AUTH';
        isBusinessAction = true;
        actionName = actionUpper === 'LOGIN' ? '用户登录系统 (Login)' : actionUpper === 'LOGOUT' ? '用户安全登出 (Logout)' : '身份认证操作';
    } else if (actionUpper === 'PAGE_VIEW') {
        category = 'PAGE_VIEW';
        isBusinessAction = false;
        actionName = `浏览页面: ${moduleName}`;
    } else if (actionUpper === 'BUTTON_CLICK') {
        // High-Value Confirmed Delivery Actions
        if (btnUpper.includes('SAHKAN HANTARAN') || btnUpper.includes('CONFIRM DELIVERY') || details.custom_action === 'OPEN_UNLOAD_MODAL') {
            category = 'DELIVERY';
            isBusinessAction = false;
            actionName = '准备送货签收: 打开卸货交接窗口';
            if (!target && details.orderNumber) target = `工单 #${details.orderNumber}`;
        } else if (btnUpper.includes('HANTAR DROP POINT') || btnUpper.includes('SUBMIT THIS DROP POINT') || details.custom_action === 'SUBMIT_DROP_POINT') {
            category = 'DELIVERY';
            isBusinessAction = false;
            actionName = '提交送货签收: 点击【提交交接】';
            if (!target && details.orderNumber) target = `工单 #${details.orderNumber}`;
        } else if (btnUpper.includes('AMBIL GAMBAR') || btnUpper.includes('PHOTO')) {
            category = 'DELIVERY';
            isBusinessAction = true;
            actionName = '拍摄送货照片凭证 (Photo Proof)';
        } else if (btnUpper.includes('MULAKAN TRIP') || btnUpper.includes('START TRIP')) {
            category = 'DELIVERY';
            isBusinessAction = true;
            actionName = '开始送货行程 (Start Trip)';
        } else if (btnUpper.includes('TAMATKAN TRIP') || btnUpper.includes('END TRIP')) {
            category = 'DELIVERY';
            isBusinessAction = true;
            actionName = '结束送货行程 (End Trip)';
        } else if (btnUpper.includes('PERMOHONAN CUTI') || btnUpper.includes('SUBMIT LEAVE')) {
            category = 'HR';
            isBusinessAction = true;
            actionName = '提交请假申请 (Submit Leave)';
        } else {
            // Contextual UI button interactions
            category = isOfficeDispatch ? 'DISPATCH' : (pageLower.includes('delivery') ? 'DELIVERY' : pageLower.includes('production') ? 'PRODUCTION' : pageLower.includes('hr') || pageLower.includes('leave') ? 'HR' : 'BUTTON_CLICK');
            isBusinessAction = false; // UI intermediate clicks are telemetry

            if (btnUpper === 'ADD' || btnUpper === '+ ADD' || btnUpper === '+' || btnUpper === 'TAMBAH') {
                if (isOfficeDispatch || pageLower.includes('order')) {
                    actionName = '编制送货单: 点击【添加商品行】';
                    target = target || '送货单明细录入';
                } else if (pageLower.includes('material') || pageLower.includes('inventory')) {
                    actionName = '物料管理: 点击【添加物料】';
                } else if (modalTitle) {
                    actionName = `点击【添加 / ${modalTitle}】`;
                } else {
                    actionName = `点击界面按钮: 【添加 / Add】`;
                }
            } else if (btnUpper.includes('SAVE') || btnUpper.includes('SIMPAN') || btnUpper.includes('CONFIRM TRIP')) {
                if (isOfficeDispatch || pageLower.includes('order')) {
                    actionName = '送货调度: 保存送货单 / 确认行程';
                    target = target || '送货单排程修改';
                    if (!details.orderNumber && !details.items) {
                        legacyHint = '该条记录产生于系统版本升级前（仅记录了界面点击事件，未包含结构化订单快照）。当前最新版本已全面升级，后续所有操作均会自动记录 DO 编号、客户名称、指派司机及商品明细。';
                    }
                } else if (modalTitle) {
                    actionName = `点击保存: 【${modalTitle}】`;
                } else {
                    actionName = `点击界面按钮: 【保存 / Save】`;
                }
            } else if (btnUpper.includes('DELETE') || btnUpper.includes('REMOVE') || btnUpper.includes('PADAM')) {
                actionName = `点击界面【删除 / Delete】`;
            } else if (btnUpper.includes('EXPORT') || btnUpper.includes('DOWNLOAD')) {
                actionName = `导出数据: 【${rawBtn}】`;
            } else {
                actionName = `点击按钮: ${rawBtn.length > 25 ? rawBtn.substring(0, 25) + '...' : rawBtn || '界面交互'}`;
            }
        }
    }

    // Extract Photos (DO photo, product photo, hopper photo, etc.)
    const rawPhotos: string[] = [];
    if (Array.isArray(details.photos)) {
        details.photos.forEach((p: any) => { if (typeof p === 'string' && (p.startsWith('http') || p.startsWith('data:image/'))) rawPhotos.push(p); });
    }
    if (typeof details.photoUrl === 'string' && (details.photoUrl.startsWith('http') || details.photoUrl.startsWith('data:image/'))) rawPhotos.push(details.photoUrl);
    if (typeof details.photo_url === 'string' && (details.photo_url.startsWith('http') || details.photo_url.startsWith('data:image/'))) rawPhotos.push(details.photo_url);
    if (typeof details.prodUrl === 'string' && (details.prodUrl.startsWith('http') || details.prodUrl.startsWith('data:image/'))) rawPhotos.push(details.prodUrl);
    if (typeof details.doUrl === 'string' && (details.doUrl.startsWith('http') || details.doUrl.startsWith('data:image/'))) rawPhotos.push(details.doUrl);
    if (typeof details.proof_of_delivery_url === 'string' && details.proof_of_delivery_url.startsWith('http')) rawPhotos.push(details.proof_of_delivery_url);
    if (typeof details.proof_of_load_url === 'string' && details.proof_of_load_url.startsWith('http')) rawPhotos.push(details.proof_of_load_url);
    if (typeof details.pod_photo_url === 'string' && details.pod_photo_url.startsWith('http')) rawPhotos.push(details.pod_photo_url);
    if (typeof details.hopper_photo_url === 'string' && details.hopper_photo_url.startsWith('http')) rawPhotos.push(details.hopper_photo_url);
    const photos = Array.from(new Set(rawPhotos));

    // Extract GPS & Navigation Map
    let gps: { lat: number; lng: number } | string | null = null;
    let mapsUrl: string | null = null;
    if (details.gps) {
        if (typeof details.gps === 'string' && !details.gps.includes('Fetching')) {
            gps = details.gps;
            const parts = details.gps.split(',').map((s: string) => parseFloat(s.trim()));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                mapsUrl = `https://www.google.com/maps?q=${parts[0]},${parts[1]}`;
            }
        } else if (typeof details.gps === 'object' && details.gps.lat && details.gps.lng) {
            gps = details.gps;
            mapsUrl = `https://www.google.com/maps?q=${details.gps.lat},${details.gps.lng}`;
        }
    } else if (details.latitude && details.longitude) {
        gps = { lat: parseFloat(details.latitude), lng: parseFloat(details.longitude) };
        mapsUrl = `https://www.google.com/maps?q=${details.latitude},${details.longitude}`;
    } else if (details.coordinates) {
        gps = details.coordinates;
        if (typeof details.coordinates === 'string') {
            const parts = details.coordinates.split(',').map((s: string) => parseFloat(s.trim()));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                mapsUrl = `https://www.google.com/maps?q=${parts[0]},${parts[1]}`;
            }
        }
    }

    // Extract Structured Items & Quantities
    let items: any[] = [];
    if (Array.isArray(details.items)) {
        items = details.items;
    } else if (Array.isArray(details.materials)) {
        items = details.materials;
    } else if (Array.isArray(details.loadItems)) {
        items = details.loadItems;
    } else if (details.material && (details.qty || details.newQty)) {
        items = [{ name: details.material, qty: details.newQty || details.qty, unit: details.unit || 'kg', oldQty: details.oldQty }];
    }

    // Determine Total Quantity Summary Badge
    let totalQtySummary: string | undefined = undefined;
    if (details.totalQuantity) {
        totalQtySummary = `${details.totalQuantity} 件`;
    } else if (details.countDays || details.count_days) {
        totalQtySummary = `${details.countDays || details.count_days} 天`;
    } else if (details.qty || details.newQty) {
        totalQtySummary = `${details.newQty || details.qty} ${details.unit || 'kg'}`;
    } else if (items.length > 0) {
        const totalSum = items.reduce((sum, i) => sum + (Number(i.quantity || i.qty || i.confirmedQty || 0) || 0), 0);
        if (totalSum > 0) {
            totalQtySummary = `${totalSum} ${items[0]?.unit || '件'}`;
        } else {
            totalQtySummary = `${items.length} 项明细`;
        }
    }

    // 3. Where
    let deviceType: 'Mobile' | 'Tablet' | 'Desktop' = 'Desktop';
    if (details.device?.type) {
        deviceType = details.device.type;
    } else if (who.role === 'Driver' || who.role === 'Operator' || pageLower.includes('driver') || pageLower.includes('scanner')) {
        deviceType = 'Mobile';
    }

    // 4. When
    const dateObj = new Date(raw.created_at);
    const formattedDate = dateObj.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const formattedTime = dateObj.toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const relativeTime = getRelativeTime(raw.created_at);
    const hour = dateObj.getHours();
    const hourKey = `${String(hour).padStart(2, '0')}:00`;

    let shiftInfo = {
        name: '☀️ 正常日常班次',
        type: 'normal' as 'early' | 'normal' | 'late' | 'night',
        tagClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        description: '标准运营日间班次 (07:00 - 18:00)'
    };

    if (hour >= 4 && hour < 7) {
        shiftInfo = {
            name: '🌅 清晨早班 / 提前出车',
            type: 'early',
            tagClass: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
            description: '清晨早班时段 (04:00 - 07:00)，通常为提前装车发运或出车巡检'
        };
    } else if (hour >= 18 && hour < 22) {
        shiftInfo = {
            name: '🌆 晚班 / 延时作业',
            type: 'late',
            tagClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
            description: '晚班/延时配送时段 (18:00 - 22:00)'
        };
    } else if (hour >= 22 || hour < 4) {
        shiftInfo = {
            name: '🌙 深夜非常规时段',
            type: 'night',
            tagClass: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
            description: '非工作常规时段访问 (22:00 - 04:00)'
        };
    }

    // 5. Result
    let status: 'SUCCESS' | 'FAILED' | 'WARNING' | 'INFO' = 'SUCCESS';
    if (details.status) {
        status = details.status;
    } else if (category === 'ERROR' || actionUpper.includes('ERROR') || actionUpper.includes('FAIL')) {
        status = 'FAILED';
    } else if (actionUpper.includes('WARN')) {
        status = 'WARNING';
    }

    let summary = details.result_summary || details.resultSummary;
    if (!summary) {
        if (actionUpper === 'BUTTON_CLICK') {
            if (btnUpper.includes('SAHKAN HANTARAN') || btnUpper.includes('CONFIRM DELIVERY') || details.custom_action === 'OPEN_UNLOAD_MODAL') {
                summary = `司机 ${who.name} 点击准备送货签收，打开卸货交接与单据拍照窗口`;
            } else if (btnUpper.includes('HANTAR DROP POINT') || btnUpper.includes('SUBMIT THIS DROP POINT') || details.custom_action === 'SUBMIT_DROP_POINT') {
                summary = `司机 ${who.name} 点击提交送货点交接`;
            } else if (btnUpper.includes('AMBIL GAMBAR') || btnUpper.includes('PHOTO')) {
                summary = `司机 ${who.name} 拍摄并上传货物/DO送货凭证`;
            } else if (btnUpper === 'ADD' || btnUpper === '+ ADD' || btnUpper === '+' || btnUpper === 'TAMBAH') {
                if (pageLower === 'delivery' || pageLower.includes('order')) {
                    summary = `${who.name} 在送货调度中心点击【添加商品行】，准备录入订单货物明细`;
                } else {
                    summary = `${who.name} 在 [${moduleName}] 页面点击了【添加 / Add】按钮`;
                }
            } else if (btnUpper.includes('SAVE') || btnUpper.includes('SIMPAN') || btnUpper.includes('CONFIRM TRIP')) {
                if (isOfficeDispatch) {
                    summary = `${who.name} (${who.role}) 在送货调度中心提交了送货单编排与行程保存操作`;
                } else if (modalTitle) {
                    summary = `${who.name} 在 [${modalTitle}] 中提交了表单保存`;
                } else {
                    summary = `${who.name} 在 [${moduleName}] 提交了保存操作`;
                }
            } else {
                summary = `${who.name} 在 [${moduleName}] 触发了【${rawBtn || '按钮'}】交互`;
            }
        } else if (category === 'AUTH') {
            summary = actionUpper === 'LOGIN' 
                ? `${who.name} (${who.role}) 身份认证通过，进入 PackSecure OS` 
                : `${who.name} 安全退出登录`;
        } else if (category === 'PAGE_VIEW') {
            summary = `${who.name} 打开并浏览 [${moduleName}]`;
        } else if (category === 'DISPATCH') {
            summary = `${who.name} (${who.role}) 编制并调度送货单/行程排班`;
        } else if (category === 'DELIVERY') {
            summary = `司机 ${who.name} 成功提交送货交付记录`;
        } else if (category === 'HR') {
            summary = `员工 ${who.name} 提交考勤/请假申请`;
        } else if (category === 'PRODUCTION') {
            summary = `操作员 ${who.name} 在生产车间执行机台操作`;
        } else if (category === 'ADMIN') {
            summary = `管理员 ${who.name} 更新系统/人员配置`;
        } else if (status === 'SUCCESS') {
            summary = '操作执行成功并已记录';
        } else if (status === 'FAILED') {
            summary = details.error || '操作执行未成功';
        } else {
            summary = '正常操作记录';
        }
    }

    // Compliance Check (Missing proof alert for field operations)
    // IMPORTANT: Only check when a real business delivery is submitted, NEVER on intermediate UI button clicks!
    const isFieldAction = actionUpper === 'DRIVER_CONFIRM_DROP_POINT' || actionUpper === 'DRIVER_COMPLETE_TRIP' || (category === 'DELIVERY' && isBusinessAction && actionUpper !== 'BUTTON_CLICK');
    const hasMissingProofAlert = isFieldAction && (photos.length === 0 || !gps);
    let missingProofMessage: string | undefined = undefined;
    if (hasMissingProofAlert) {
        if (photos.length === 0 && !gps) missingProofMessage = '⚠️ 现场送货未采集到实拍照片与 GPS 坐标';
        else if (photos.length === 0) missingProofMessage = '⚠️ 现场送货未采集到实拍照片凭证';
        else missingProofMessage = '⚠️ 现场送货未采集到有效 GPS 坐标';
    }

    const isAnomaly = status === 'FAILED' || category === 'ERROR';

    return {
        id: raw.id,
        raw,
        who,
        what: {
            category,
            actionName,
            rawAction: raw.action,
            target,
            isBusinessAction,
            totalQtySummary,
            legacyHint
        },
        where: {
            moduleName,
            rawModule,
            location: details.destination || details.location || who.factory,
            gps,
            mapsUrl,
            deviceType,
            deviceScreen: details.device?.screen,
            elementId: details.element_id
        },
        when: {
            raw: raw.created_at,
            formattedDate,
            formattedTime,
            relativeTime,
            hourKey,
            shiftInfo
        },
        result: {
            status,
            summary,
            photos,
            items: items.length > 0 ? items : undefined,
            changes: details.changes || null,
            error: details.error,
            isAnomaly,
            hasMissingProofAlert,
            missingProofMessage
        }
    };
}

const ActivityLogs: React.FC<ActivityLogsProps> = ({ user }) => {
    // State
    const [rawLogs, setRawLogs] = useState<ActivityLogRaw[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Filters
    const [activeTab, setActiveTab] = useState<'business' | 'all'>('business');
    const [filterUser, setFilterUser] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterDatePreset, setFilterDatePreset] = useState<string>('7d');
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    
    // Pagination
    const [pageSize, setPageSize] = useState<number>(50);
    const [currentPage, setCurrentPage] = useState<number>(1);
    
    // Analytics & Charts Toggle
    const [showCharts, setShowCharts] = useState<boolean>(true);
    const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0); // 0 = off, 15, 30, 60

    // Detail Drawer & Photo Lightbox
    const [selectedLog, setSelectedLog] = useState<Parsed5W1HLog | null>(null);
    const [copiedJson, setCopiedJson] = useState<boolean>(false);
    const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

    // Users list for dropdown
    const [usersList, setUsersList] = useState<{ id: string; name: string; email: string; role: string }[]>([]);

    // Metadata Context for Dual-Insurance Resolution (Driver Lorries & User Base Locations)
    const [auditMetadata, setAuditMetadata] = useState<AuditMetadataContext>({
        driverLorryMap: {},
        userMetadataMap: {}
    });

    const isManagerRole = user?.role === 'SuperAdmin' || user?.role === 'Admin';

    // Fetch user list, base locations and lorries
    const fetchUsersList = useCallback(async () => {
        try {
            const [v2Res, pubRes, lorriesRes] = await Promise.all([
                supabase.from('sys_users_v2').select('auth_user_id, name, email, role, employee_id, factory_id').order('name'),
                supabase.from('users_public').select('id, name, email, role, employee_id, base_location, factory_id'),
                supabase.from('lorries').select('id, plate_number, driver_id, driver_name, status')
            ]);

            const userMeta: Record<string, { baseLocation?: string; employeeId?: string; role?: string }> = {};
            const driverLorry: Record<string, { plate: string; status?: string }> = {};

            // 1. Map users_public
            if (pubRes.data) {
                pubRes.data.forEach((u: any) => {
                    const loc = u.base_location || u.factory_id || undefined;
                    if (u.id) {
                        userMeta[u.id] = {
                            baseLocation: loc,
                            employeeId: u.employee_id,
                            role: u.role
                        };
                    }
                    if (u.name) {
                        userMeta[u.name.toLowerCase().trim()] = {
                            baseLocation: loc,
                            employeeId: u.employee_id,
                            role: u.role
                        };
                    }
                });
            }

            // 2. Map sys_users_v2 & populate users dropdown
            if (v2Res.data) {
                setUsersList(v2Res.data.map((d: any) => ({
                    id: d.auth_user_id,
                    name: d.name || d.email?.split('@')[0] || 'Unknown',
                    email: d.email,
                    role: d.role
                })));

                v2Res.data.forEach((u: any) => {
                    const loc = u.factory_id || undefined;
                    if (u.auth_user_id) {
                        userMeta[u.auth_user_id] = {
                            baseLocation: userMeta[u.auth_user_id]?.baseLocation || loc,
                            employeeId: u.employee_id || userMeta[u.auth_user_id]?.employeeId,
                            role: u.role || userMeta[u.auth_user_id]?.role
                        };
                    }
                    if (u.name) {
                        const key = u.name.toLowerCase().trim();
                        userMeta[key] = {
                            baseLocation: userMeta[key]?.baseLocation || loc,
                            employeeId: u.employee_id || userMeta[key]?.employeeId,
                            role: u.role || userMeta[key]?.role
                        };
                    }
                });
            }

            // 3. Map lorries
            if (lorriesRes.data) {
                lorriesRes.data.forEach((l: any) => {
                    if (l.driver_id) {
                        driverLorry[l.driver_id] = { plate: l.plate_number, status: l.status };
                    }
                    if (l.driver_name) {
                        driverLorry[l.driver_name.toLowerCase().trim()] = { plate: l.plate_number, status: l.status };
                    }
                });
            }

            setAuditMetadata({
                driverLorryMap: driverLorry,
                userMetadataMap: userMeta
            });
        } catch (err) {
            console.error('Failed to fetch user & lorry metadata:', err);
        }
    }, []);

    // Fetch Logs from Supabase with Server-Side filtering
    const fetchLogs = useCallback(async (isBackground = false) => {
        if (!user) return;
        if (!isBackground) setLoading(true);
        else setRefreshing(true);

        try {
            let query = supabase
                .from('user_activity_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1000); // Fetch up to 1000 recent logs for smooth client-side slice & analytics

            // If not SuperAdmin/Admin, RLS forces user's own logs, but we also filter user_id explicitly
            if (!isManagerRole) {
                query = query.eq('user_id', user.uid);
            } else if (filterUser !== 'all') {
                query = query.eq('user_id', filterUser);
            }

            // Date filtering
            const now = new Date();
            if (filterDatePreset === 'today') {
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
                query = query.gte('created_at', todayStart);
            } else if (filterDatePreset === 'yesterday') {
                const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
                const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
                query = query.gte('created_at', yesterdayStart).lt('created_at', yesterdayEnd);
            } else if (filterDatePreset === '7d') {
                const start7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
                query = query.gte('created_at', start7d);
            } else if (filterDatePreset === '30d') {
                const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
                query = query.gte('created_at', start30d);
            } else if (filterDatePreset === 'custom') {
                if (customStartDate) query = query.gte('created_at', new Date(customStartDate).toISOString());
                if (customEndDate) {
                    const end = new Date(customEndDate);
                    end.setHours(23, 59, 59, 999);
                    query = query.lte('created_at', end.toISOString());
                }
            }

            const { data, error } = await query;
            if (error) {
                console.error('Error fetching activity logs:', error);
            } else if (data) {
                setRawLogs(data);
            }
        } catch (err) {
            console.error('Exception fetching activity logs:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user, isManagerRole, filterUser, filterDatePreset, customStartDate, customEndDate]);

    // Initial Load & Listeners
    useEffect(() => {
        if (!user) return;
        fetchLogs();
        if (isManagerRole) {
            fetchUsersList();
        }
    }, [user, isManagerRole, fetchLogs, fetchUsersList]);

    // Auto-refresh interval
    useEffect(() => {
        if (autoRefreshInterval <= 0) return;
        const timer = setInterval(() => {
            fetchLogs(true);
        }, autoRefreshInterval * 1000);
        return () => clearInterval(timer);
    }, [autoRefreshInterval, fetchLogs]);

    // Parse all raw logs into 5W1H format
    const parsedLogs = useMemo(() => {
        return rawLogs.map(r => parse5W1HLog(r, auditMetadata));
    }, [rawLogs, auditMetadata]);

    // Filter parsed logs
    const filteredLogs = useMemo(() => {
        return parsedLogs.filter(log => {
            // Tab filter: Business actions only vs All (unless a specific category filter is chosen)
            if (activeTab === 'business' && filterCategory === 'all' && !log.what.isBusinessAction) {
                return false;
            }

            // Category filter
            if (filterCategory !== 'all' && log.what.category !== filterCategory) {
                return false;
            }

            // Status filter
            if (filterStatus !== 'all' && log.result.status !== filterStatus) {
                return false;
            }

            // Search query (Searches across who, what, where, when, result, and raw details)
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase().trim();
                const matchName = log.who.name.toLowerCase().includes(query);
                const matchEmail = log.who.email.toLowerCase().includes(query);
                const matchRole = log.who.role.toLowerCase().includes(query);
                const matchAction = log.what.actionName.toLowerCase().includes(query) || log.what.rawAction.toLowerCase().includes(query);
                const matchTarget = (log.what.target || '').toLowerCase().includes(query);
                const matchModule = log.where.moduleName.toLowerCase().includes(query) || log.where.rawModule.toLowerCase().includes(query);
                const matchSummary = log.result.summary.toLowerCase().includes(query);
                const matchDetails = JSON.stringify(log.raw.details || {}).toLowerCase().includes(query);

                if (!matchName && !matchEmail && !matchRole && !matchAction && !matchTarget && !matchModule && !matchSummary && !matchDetails) {
                    return false;
                }
            }

            return true;
        });
    }, [parsedLogs, activeTab, filterCategory, filterStatus, searchQuery]);

    // Metrics calculation
    const metrics = useMemo(() => {
        const todayStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const todayLogs = parsedLogs.filter(l => l.when.formattedDate === todayStr);
        
        const activeUsersSet = new Set(todayLogs.map(l => l.who.email || l.who.id));
        const businessActionCount = parsedLogs.filter(l => l.what.isBusinessAction).length;
        const anomalyCount = parsedLogs.filter(l => l.result.isAnomaly).length;
        const totalFiltered = filteredLogs.length;

        return {
            totalToday: todayLogs.length,
            activeUsersToday: activeUsersSet.size,
            businessActions: businessActionCount,
            anomalies: anomalyCount,
            totalFiltered
        };
    }, [parsedLogs, filteredLogs]);

    // 24-Hour Trend Chart Data
    const hourlyChartData = useMemo(() => {
        const hoursMap: Record<string, { hour: string; total: number; business: number; anomaly: number }> = {};
        
        // Initialize 24 hours
        for (let i = 0; i < 24; i++) {
            const h = `${String(i).padStart(2, '0')}:00`;
            hoursMap[h] = { hour: h, total: 0, business: 0, anomaly: 0 };
        }

        // Aggregate today's or recent logs
        parsedLogs.forEach(log => {
            const h = log.when.hourKey;
            if (hoursMap[h]) {
                hoursMap[h].total += 1;
                if (log.what.isBusinessAction) hoursMap[h].business += 1;
                if (log.result.isAnomaly) hoursMap[h].anomaly += 1;
            }
        });

        return Object.values(hoursMap);
    }, [parsedLogs]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
    const paginatedLogs = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredLogs.slice(start, start + pageSize);
    }, [filteredLogs, currentPage, pageSize]);

    // Reset page to 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, filterUser, filterCategory, filterStatus, filterDatePreset, customStartDate, customEndDate, searchQuery, pageSize]);

    // Excel Export Handler
    const handleExportExcel = () => {
        if (filteredLogs.length === 0) {
            alert('当前没有可导出的日志数据');
            return;
        }

        const exportData = filteredLogs.map((log, index) => ({
            '序号': index + 1,
            '时间 (When)': `${log.when.formattedDate} ${log.when.formattedTime}`,
            '相对时间': log.when.relativeTime,
            '操作人 (Who)': log.who.name,
            '邮箱': log.who.email,
            '角色': log.who.role,
            '所属工厂/地点': log.who.factory || log.where.location || '-',
            '操作分类 (Category)': log.what.category,
            '动作名称 (What)': log.what.actionName,
            '原始动作标识': log.what.rawAction,
            '操作目标对象 (Target)': log.what.target || '-',
            '系统模块 (Where)': log.where.moduleName,
            '终端设备': `${log.where.deviceType} (${log.where.deviceScreen || '-'})`,
            '执行结果 (Result)': log.result.status,
            '结果摘要': log.result.summary,
            '变更对比 (Diff)': log.result.changes ? JSON.stringify(log.result.changes) : '-',
            '原始详情 JSON': JSON.stringify(log.raw.details || {})
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Activity Logs');

        // Generate filename with timestamp
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = new Date().toTimeString().slice(0, 5).replace(/:/g, '');
        XLSX.writeFile(workbook, `Packsecure_Audit_Logs_${dateStr}_${timeStr}.xlsx`);
    };

    // Copy JSON Helper
    const handleCopyJson = (jsonObj: any) => {
        navigator.clipboard.writeText(JSON.stringify(jsonObj, null, 2));
        setCopiedJson(true);
        setTimeout(() => setCopiedJson(false), 2000);
    };

    // Category Badge Component
    const renderCategoryBadge = (category: ActionCategory) => {
        switch (category) {
            case 'PRODUCTION':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800">
                        <Factory className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        生产排产
                    </span>
                );
            case 'DELIVERY':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800">
                        <Truck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        司机配送
                    </span>
                );
            case 'DISPATCH':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-800">
                        <Truck className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                        调度排单
                    </span>
                );
            case 'MATERIAL':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
                        <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        物料库存
                    </span>
                );
            case 'HR':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800">
                        <UserCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        人事考勤
                    </span>
                );
            case 'AUTH':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
                        <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        身份认证
                    </span>
                );
            case 'ADMIN':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800">
                        <Shield className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        权限配置
                    </span>
                );
            case 'BUTTON_CLICK':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        <MousePointer className="w-3.5 h-3.5 text-slate-500" />
                        按钮点击
                    </span>
                );
            case 'PAGE_VIEW':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-50 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800">
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        页面浏览
                    </span>
                );
            case 'ERROR':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        异常报错
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-50 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                        <Activity className="w-3.5 h-3.5 text-gray-500" />
                        常规操作
                    </span>
                );
        }
    };

    // Role Color Badge Helper
    const renderRoleBadge = (role: string) => {
        const roleLower = (role || '').toLowerCase();
        let colorClass = 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
        if (roleLower.includes('super')) {
            colorClass = 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
        } else if (roleLower.includes('admin') || roleLower.includes('manager')) {
            colorClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
        } else if (roleLower.includes('driver')) {
            colorClass = 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
        } else if (roleLower.includes('operator')) {
            colorClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
        } else if (roleLower.includes('logistics')) {
            colorClass = 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800';
        }

        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${colorClass}`}>
                {role}
            </span>
        );
    };

    // Status Pill Component
    const renderStatusPill = (status: 'SUCCESS' | 'FAILED' | 'WARNING' | 'INFO', isAnomaly: boolean) => {
        if (isAnomaly || status === 'FAILED') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-300 dark:border-red-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping mr-0.5"></span>
                    <XCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
                    失败 / 异常
                </span>
            );
        }
        if (status === 'WARNING') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    警告
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                成功
            </span>
        );
    };

    // Device Icon Helper
    const renderDeviceIcon = (deviceType: string) => {
        if (deviceType === 'Mobile') {
            return <Smartphone className="w-3.5 h-3.5 text-gray-400" title="移动端" />;
        }
        if (deviceType === 'Tablet') {
            return <Tablet className="w-3.5 h-3.5 text-gray-400" title="平板端" />;
        }
        return <Monitor className="w-3.5 h-3.5 text-gray-400" title="桌面端" />;
    };

    if (!user) {
        return (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                请先登录系统以查看操作审计日志。
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6 animate-fade-in font-sans">
            {/* Header Title & Top Controls */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-all">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl text-white shadow-md shadow-blue-500/20">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                                5W1H 系统活动与审计追踪
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                                实时审计
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {isManagerRole 
                                ? '全面追踪【谁在什么时间、在哪里、做了什么操作、产生什么结果】的全系统 5W1H 审计记录。' 
                                : '查看您个人的系统操作记录与交互轨迹。'}
                        </p>
                    </div>
                </div>

                {/* Header Action Tools */}
                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                    {/* Auto Refresh Toggle */}
                    <div className="flex items-center bg-gray-50 dark:bg-gray-700/60 rounded-xl p-1 border border-gray-200 dark:border-gray-600 text-xs">
                        <span className="px-2.5 text-gray-500 dark:text-gray-400 font-medium">自动刷新:</span>
                        {[
                            { label: '关', value: 0 },
                            { label: '15s', value: 15 },
                            { label: '30s', value: 30 },
                            { label: '60s', value: 60 }
                        ].map(item => (
                            <button
                                key={item.value}
                                onClick={() => setAutoRefreshInterval(item.value)}
                                className={`px-2.5 py-1 rounded-lg transition-all font-medium ${
                                    autoRefreshInterval === item.value 
                                        ? 'bg-blue-600 text-white shadow-sm' 
                                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    {/* Manual Refresh Button */}
                    <button
                        onClick={() => fetchLogs(false)}
                        disabled={loading || refreshing}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs md:text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                        title="刷新日志"
                    >
                        <RefreshCw className={`w-4 h-4 text-gray-500 dark:text-gray-400 ${refreshing || loading ? 'animate-spin' : ''}`} />
                        <span>刷新</span>
                    </button>

                    {/* Export Excel Button */}
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs md:text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md shadow-emerald-600/20 active:scale-95"
                        title="导出当前筛选日志为 Excel"
                    >
                        <Download className="w-4 h-4" />
                        <span>导出 Excel</span>
                    </button>

                    {/* Charts Toggle Button */}
                    <button
                        onClick={() => setShowCharts(!showCharts)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs md:text-sm font-medium border transition-all ${
                            showCharts 
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' 
                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600'
                        }`}
                        title="展开/收起统计图表"
                    >
                        <BarChart3 className="w-4 h-4" />
                        <span>{showCharts ? '收起图表' : '分析看板'}</span>
                    </button>
                </div>
            </div>

            {/* Top Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">今日活动总数</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{metrics.totalToday.toLocaleString()}</p>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">累计操作记录</span>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                        <Activity className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">今日活跃用户</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{metrics.activeUsersToday.toLocaleString()}</p>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400">活跃协同中</span>
                    </div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                        <UserIcon className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">核心业务操作</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{metrics.businessActions.toLocaleString()}</p>
                        <span className="text-[11px] text-indigo-600 dark:text-indigo-400">生产/交付/物料</span>
                    </div>
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <Sparkles className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">异常 / 失败操作</p>
                        <p className={`text-2xl font-bold mt-1 ${metrics.anomalies > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                            {metrics.anomalies.toLocaleString()}
                        </p>
                        <span className="text-[11px] text-red-500 dark:text-red-400">需管理员关注</span>
                    </div>
                    <div className={`p-3 rounded-xl ${metrics.anomalies > 0 ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse' : 'bg-gray-50 dark:bg-gray-700 text-gray-400'}`}>
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* 24-Hour Trend Chart Section (Collapsible) */}
            {showCharts && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-all animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">24小时活动频次与操作趋势分析</h2>
                        </div>
                        <span className="text-xs text-gray-400">时间轴 (每小时分布)</span>
                    </div>

                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={hourlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="totalColor" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="bizColor" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="hour" stroke="#9CA3AF" fontSize={11} tickLine={false} />
                                <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} allowDecimals={false} />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: '#1F2937', 
                                        borderRadius: '0.75rem', 
                                        border: 'none', 
                                        color: '#fff',
                                        fontSize: '12px'
                                    }} 
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="total" name="总活动数" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#totalColor)" />
                                <Area type="monotone" dataKey="business" name="核心业务操作" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#bizColor)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Filter & Search Toolbar */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                {/* Row 1: Quick Tab & Global Search */}
                <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
                    {/* Quick Tab: Business Only vs All */}
                    <div className="flex bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl w-full md:w-auto">
                        <button
                            onClick={() => setActiveTab('business')}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                                activeTab === 'business'
                                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                            }`}
                        >
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            <span>关键业务操作</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                                {metrics.businessActions}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                                activeTab === 'all'
                                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                            }`}
                        >
                            <Layers className="w-4 h-4 text-gray-500" />
                            <span>全部日志 (含页面/点击)</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300">
                                {parsedLogs.length}
                            </span>
                        </button>
                    </div>

                    {/* Global Keyword Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="全字段搜索：姓名 / 邮箱 / 工单号 / 动作 / 详情..."
                            className="w-full pl-9 pr-8 py-2.5 text-xs md:text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
                        />
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Row 1.5: Quick Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                    <span className="text-gray-400 dark:text-gray-500 shrink-0 text-[11px] font-medium mr-1">快捷分类:</span>
                    {[
                        { id: 'all', label: '全部分类' },
                        { id: 'DISPATCH', label: '📋 调度排单' },
                        { id: 'DELIVERY', label: '🚛 司机配送' },
                        { id: 'PRODUCTION', label: '🏭 生产机台' },
                        { id: 'MATERIAL', label: '📦 物料库存' },
                        { id: 'HR', label: '👥 人事考勤' },
                        { id: 'AUTH', label: '🔑 身份认证' },
                        { id: 'ADMIN', label: '🛡️ 权限配置' },
                        { id: 'ERROR', label: '⚠️ 异常报错' },
                        { id: 'PAGE_VIEW', label: '👁️ 页面浏览' },
                    ].map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setFilterCategory(cat.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                                filterCategory === cat.id
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Row 2: Detailed 5W1H Filter Controls */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-2 border-t border-gray-100 dark:border-gray-700/60">
                    {/* Filter User (SuperAdmin & Admin only) */}
                    {isManagerRole && (
                        <div>
                            <label className="block text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1">
                                👤 操作人员 (Who)
                            </label>
                            <select
                                value={filterUser}
                                onChange={(e) => setFilterUser(e.target.value)}
                                className="w-full text-xs bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl p-2 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">全部人员 (All Users)</option>
                                {usersList.map(u => (
                                    <option key={u.id} value={u.id}>
                                        {u.name} ({u.role})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Filter Action Category (What) */}
                    <div>
                        <label className="block text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1">
                            ⚡ 操作分类 (What)
                        </label>
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="w-full text-xs bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl p-2 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">全部分类</option>
                            <option value="DISPATCH">调度排单 (Dispatch)</option>
                            <option value="DELIVERY">司机配送 (Driver Delivery)</option>
                            <option value="PRODUCTION">生产排产 (Production)</option>
                            <option value="MATERIAL">物料库存 (Material)</option>
                            <option value="HR">人事考勤 (HR)</option>
                            <option value="AUTH">身份认证 (Auth)</option>
                            <option value="ADMIN">权限配置 (Admin)</option>
                            <option value="BUTTON_CLICK">按钮点击 (Clicks)</option>
                            <option value="PAGE_VIEW">页面浏览 (Page Views)</option>
                            <option value="ERROR">异常报错 (Errors)</option>
                        </select>
                    </div>

                    {/* Filter Status (Result) */}
                    <div>
                        <label className="block text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1">
                            🎯 执行结果 (Result)
                        </label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full text-xs bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl p-2 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">全部状态</option>
                            <option value="SUCCESS">✅ 成功 (Success)</option>
                            <option value="FAILED">❌ 失败 / 异常 (Failed)</option>
                            <option value="WARNING">⚠️ 警告 (Warning)</option>
                        </select>
                    </div>

                    {/* Filter Date Preset (When) */}
                    <div>
                        <label className="block text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1">
                            🕒 时间范围 (When)
                        </label>
                        <select
                            value={filterDatePreset}
                            onChange={(e) => setFilterDatePreset(e.target.value)}
                            className="w-full text-xs bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl p-2 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="today">今天 (Today)</option>
                            <option value="yesterday">昨天 (Yesterday)</option>
                            <option value="7d">最近 7 天 (Last 7 Days)</option>
                            <option value="30d">最近 30 天 (Last 30 Days)</option>
                            <option value="all">所有时间段</option>
                            <option value="custom">自定义日期范围...</option>
                        </select>
                    </div>

                    {/* Page Size Selector */}
                    <div>
                        <label className="block text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1">
                            📄 每页显示
                        </label>
                        <select
                            value={pageSize}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                            className="w-full text-xs bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl p-2 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value={50}>50 条 / 页</option>
                            <option value={100}>100 条 / 页</option>
                            <option value={200}>200 条 / 页</option>
                            <option value={500}>500 条 / 页</option>
                        </select>
                    </div>
                </div>

                {/* Custom Date Range Picker when selected */}
                {filterDatePreset === 'custom' && (
                    <div className="flex flex-wrap items-center gap-3 pt-2 text-xs bg-blue-50/50 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-100 dark:border-blue-900/50">
                        <span className="font-semibold text-blue-900 dark:text-blue-300">自定义日期:</span>
                        <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                        />
                        <span className="text-gray-500">至</span>
                        <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                        />
                        <button
                            onClick={() => fetchLogs(false)}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            应用筛选
                        </button>
                    </div>
                )}
            </div>

            {/* 5W1H Audit Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden transition-all">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs md:text-sm text-left align-middle text-gray-600 dark:text-gray-300">
                        <thead className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase bg-gray-50/90 dark:bg-gray-700/50 backdrop-blur border-b border-gray-100 dark:border-gray-700 tracking-wider">
                            <tr>
                                <th scope="col" className="px-5 py-3.5">🕒 时间 (When)</th>
                                {isManagerRole && <th scope="col" className="px-5 py-3.5">👤 操作人 (Who)</th>}
                                <th scope="col" className="px-5 py-3.5">⚡ 做了什么 (What)</th>
                                <th scope="col" className="px-5 py-3.5">📍 在哪里 (Where)</th>
                                <th scope="col" className="px-5 py-3.5">🎯 操作结果 (Result)</th>
                                <th scope="col" className="px-4 py-3.5 text-right">详情</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                            {loading ? (
                                <tr>
                                    <td colSpan={isManagerRole ? 6 : 5} className="px-6 py-16 text-center text-gray-400">
                                        <div className="flex flex-col justify-center items-center gap-3">
                                            <div className="flex gap-1.5">
                                                <div className="w-3.5 h-3.5 rounded-full bg-blue-500 animate-bounce"></div>
                                                <div className="w-3.5 h-3.5 rounded-full bg-blue-500 animate-bounce delay-100"></div>
                                                <div className="w-3.5 h-3.5 rounded-full bg-blue-500 animate-bounce delay-200"></div>
                                            </div>
                                            <span className="text-xs font-medium">正在拉取 5W1H 审计日志...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={isManagerRole ? 6 : 5} className="px-6 py-16 text-center text-gray-400 dark:text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Activity className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                                            <p className="text-sm font-medium">未找到匹配的活动日志记录</p>
                                            <p className="text-xs text-gray-400">请尝试切换筛选条件或清除搜索关键字</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedLogs.map((log) => {
                                    const isAnomaly = log.result.isAnomaly;
                                    return (
                                        <tr
                                            key={log.id}
                                            onClick={() => setSelectedLog(log)}
                                            className={`cursor-pointer transition-all hover:bg-blue-50/50 dark:hover:bg-blue-950/20 ${
                                                isAnomaly 
                                                    ? 'bg-red-50/30 dark:bg-red-950/10' 
                                                    : 'bg-white dark:bg-gray-800'
                                            }`}
                                        >
                                            {/* When Column */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                                                    {log.when.formattedTime}
                                                    {log.when.shiftInfo && (
                                                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${log.when.shiftInfo.tagClass}`}>
                                                            {log.when.shiftInfo.name.split('/')[0].trim()}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-gray-400 mt-0.5">
                                                    {log.when.formattedDate} • <span className="text-blue-600 dark:text-blue-400 font-medium">{log.when.relativeTime}</span>
                                                </div>
                                            </td>

                                            {/* Who Column (Manager Role only) */}
                                            {isManagerRole && (
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                                                            {log.who.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-gray-900 dark:text-white leading-tight">
                                                                {log.who.name}
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-1 mt-1">
                                                                {renderRoleBadge(log.who.role)}
                                                                {log.who.lorryPlate && (
                                                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800">
                                                                        🚛 {log.who.lorryPlate}
                                                                    </span>
                                                                )}
                                                                {log.who.factory && (
                                                                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-mono">
                                                                        🏭 {log.who.factory}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            )}

                                            {/* What Column */}
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col items-start gap-1">
                                                    {renderCategoryBadge(log.what.category)}
                                                    <div className="font-semibold text-gray-900 dark:text-white text-xs mt-0.5">
                                                        {log.what.actionName}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                                        {log.what.target && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
                                                                目标: {log.what.target}
                                                            </span>
                                                        )}
                                                        {log.result.photos.length > 0 && (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50 shadow-xs">
                                                                <Camera className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                                                {log.result.photos.length} 张照片
                                                            </span>
                                                        )}
                                                        {log.what.totalQtySummary && (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50">
                                                                <Package className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                                                {log.what.totalQtySummary}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Where Column */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-800 dark:text-gray-200">
                                                    {renderDeviceIcon(log.where.deviceType)}
                                                    <span>{log.where.moduleName}</span>
                                                </div>
                                                {log.where.location && (
                                                    <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                                                        <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                                                        <span className="truncate max-w-[160px]" title={log.where.location}>{log.where.location}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1 mt-1">
                                                    {log.where.gps && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200/50">
                                                            <Navigation className="w-2.5 h-2.5 text-blue-500" /> GPS核验
                                                        </span>
                                                    )}
                                                    {log.result.hasMissingProofAlert && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200/50">
                                                            <AlertTriangle className="w-2.5 h-2.5 text-amber-500" /> 缺现场凭证
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Result Column */}
                                            <td className="px-5 py-4 max-w-xs">
                                                <div className="flex flex-col items-start gap-1">
                                                    {renderStatusPill(log.result.status, isAnomaly)}
                                                    <div className="text-xs text-gray-600 dark:text-gray-300 line-clamp-1 mt-0.5" title={log.result.summary}>
                                                        {log.result.summary}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Detail Action */}
                                            <td className="px-4 py-4 text-right whitespace-nowrap">
                                                <span className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all inline-flex items-center">
                                                    <ChevronRight className="w-4 h-4" />
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Table Footer: Pagination */}
                <div className="p-4 bg-gray-50/70 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <div>
                        显示第 <span className="font-semibold text-gray-900 dark:text-white">{(currentPage - 1) * pageSize + 1}</span> 至{' '}
                        <span className="font-semibold text-gray-900 dark:text-white">
                            {Math.min(currentPage * pageSize, filteredLogs.length)}
                        </span>{' '}
                        条，共 <span className="font-semibold text-gray-900 dark:text-white">{filteredLogs.length}</span> 条记录
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-600 transition"
                            title="上一页"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <span className="px-3 py-1 font-semibold text-gray-800 dark:text-gray-200">
                            第 {currentPage} / {totalPages} 页
                        </span>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage >= totalPages}
                            className="p-2 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-600 transition"
                            title="下一页"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* 5W1H Structured Detail Drawer / Modal */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-xl h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-700 overflow-hidden transform transition-all">
                        {/* Drawer Header */}
                        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/80 dark:bg-gray-700/50 backdrop-blur">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 rounded-lg">
                                    <Activity className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white text-base">
                                        5W1H 审计日志详细视图
                                    </h3>
                                    <p className="text-xs text-gray-400 font-mono mt-0.5">ID: {selectedLog.id}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Drawer Body */}
                        <div className="p-6 flex-1 overflow-y-auto space-y-6 text-sm">
                            {/* 5W1H Summary Cards Grid */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">核心 5 维度信息卡片</h4>
                                
                                <div className="grid grid-cols-1 gap-3">
                                    {/* 1. Who Card */}
                                    <div className="bg-gray-50 dark:bg-gray-700/40 p-4 rounded-xl border border-gray-100 dark:border-gray-600/60">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                                <UserIcon className="w-3.5 h-3.5" /> 👤 谁 (Who)
                                            </span>
                                            {renderRoleBadge(selectedLog.who.role)}
                                        </div>
                                        <div className="mt-2 flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                                                {selectedLog.who.name.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-gray-900 dark:text-white leading-tight">{selectedLog.who.name}</p>
                                                <p className="text-xs text-gray-400 mt-0.5">{selectedLog.who.email}</p>
                                                <p className="text-[11px] text-gray-400 font-mono">UID: {selectedLog.who.id}</p>
                                            </div>
                                        </div>

                                        {/* Driver Vehicle, Base Factory, & Employee ID Context */}
                                        <div className="mt-3 pt-2.5 border-t border-gray-200/60 dark:border-gray-600/60 flex flex-wrap items-center gap-2">
                                            {selectedLog.who.lorryPlate ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800">
                                                    <Truck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                                    执勤车辆: {selectedLog.who.lorryPlate}
                                                </span>
                                            ) : selectedLog.who.role === 'Driver' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                                                    <Truck className="w-3.5 h-3.5 text-gray-400" />
                                                    执勤车辆: 动态指派 / 未绑定固定车辆
                                                </span>
                                            ) : null}

                                            {selectedLog.who.factory && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800">
                                                    <Factory className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                                    归属基地: {selectedLog.who.factory}
                                                </span>
                                            )}

                                            {selectedLog.who.employeeId && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600">
                                                    工号: {selectedLog.who.employeeId}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 2. What Card */}
                                    <div className="bg-gray-50 dark:bg-gray-700/40 p-4 rounded-xl border border-gray-100 dark:border-gray-600/60">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                                <Sparkles className="w-3.5 h-3.5" /> ⚡ 做了什么 (What)
                                            </span>
                                            {renderCategoryBadge(selectedLog.what.category)}
                                        </div>
                                        <div className="mt-2 space-y-1">
                                            <p className="font-semibold text-gray-900 dark:text-white text-base">
                                                {selectedLog.what.actionName}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                                原始 Action: {selectedLog.what.rawAction}
                                            </p>
                                            {selectedLog.what.target && (
                                                <div className="mt-1 pt-1 border-t border-gray-200/50 dark:border-gray-600 text-xs">
                                                    <span className="text-gray-400">操作目标: </span>
                                                    <span className="font-semibold text-blue-600 dark:text-blue-400">{selectedLog.what.target}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 3. Where Card */}
                                    <div className="bg-gray-50 dark:bg-gray-700/40 p-4 rounded-xl border border-gray-100 dark:border-gray-600/60">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                                <MapPin className="w-3.5 h-3.5" /> 📍 在哪里 (Where)
                                            </span>
                                            {selectedLog.where.gps ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                    <Navigation className="w-3 h-3 text-blue-500" /> GPS已定位
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                                    {selectedLog.where.deviceType === 'Desktop' ? '💻 桌面端环境' : '📱 移动端'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <span className="text-gray-400 block">系统模块:</span>
                                                <span className="font-semibold text-gray-900 dark:text-white">{selectedLog.where.moduleName}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-400 block">终端设备:</span>
                                                <span className="font-semibold text-gray-900 dark:text-white">
                                                    {selectedLog.where.deviceType} {selectedLog.where.deviceScreen ? `(${selectedLog.where.deviceScreen})` : ''}
                                                </span>
                                            </div>
                                            <div className="col-span-2 pt-1 border-t border-gray-100 dark:border-gray-600/50">
                                                <span className="text-gray-400 block mb-0.5">GPS 坐标:</span>
                                                {selectedLog.where.gps ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200/60 dark:border-blue-800/60">
                                                            {typeof selectedLog.where.gps === 'string' 
                                                                ? selectedLog.where.gps 
                                                                : `${selectedLog.where.gps.lat.toFixed(6)}, ${selectedLog.where.gps.lng.toFixed(6)}`}
                                                        </span>
                                                        {selectedLog.where.mapsUrl && (
                                                            <button
                                                                onClick={() => window.open(selectedLog.where.mapsUrl!, '_blank')}
                                                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                                                            >
                                                                <ExternalLink className="w-3 h-3" />
                                                                地图核验
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 text-[11px] italic">
                                                        {selectedLog.result.hasMissingProofAlert
                                                            ? '⚠️ 现场外勤送货未采集到有效 GPS 坐标'
                                                            : selectedLog.where.deviceType === 'Desktop'
                                                                ? '💻 桌面端环境（无需外勤硬件定位）'
                                                                : '📱 移动端普通页面操作（无需外勤定位）'}
                                                    </span>
                                                )}
                                            </div>
                                            {selectedLog.where.location && (
                                                <div className="col-span-2 mt-0.5">
                                                    <span className="text-gray-400 block">地点/工厂:</span>
                                                    <span className="font-semibold text-gray-900 dark:text-white">{selectedLog.where.location}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 4. When Card */}
                                    <div className="bg-gray-50 dark:bg-gray-700/40 p-4 rounded-xl border border-gray-100 dark:border-gray-600/60">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" /> 🕒 什么时间 (When)
                                            </span>
                                            {selectedLog.when.shiftInfo && (
                                                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${selectedLog.when.shiftInfo.tagClass}`}>
                                                    {selectedLog.when.shiftInfo.name}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-2.5 flex items-start justify-between text-xs gap-3">
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-white text-sm">
                                                    {selectedLog.when.formattedDate} {selectedLog.when.formattedTime}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    <span className="text-gray-400">相对时间: {selectedLog.when.relativeTime}</span>
                                                    {selectedLog.when.shiftInfo?.description && (
                                                        <span className="text-gray-400 font-normal">({selectedLog.when.shiftInfo.description})</span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-mono text-xs rounded-lg border border-amber-200 dark:border-amber-800 shrink-0">
                                                {selectedLog.when.raw.split('.')[0].replace('T', ' ')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 5. Result Card */}
                                    <div className={`p-4 rounded-xl border ${
                                        selectedLog.result.isAnomaly 
                                            ? 'bg-red-50/50 dark:bg-red-950/30 border-red-200 dark:border-red-800' 
                                            : 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                                    }`}>
                                        <div className="flex items-center justify-between">
                                            <span className={`text-xs font-bold flex items-center gap-1.5 ${
                                                selectedLog.result.isAnomaly ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'
                                            }`}>
                                                <CheckCircle2 className="w-3.5 h-3.5" /> 🎯 什么结果 (Result)
                                            </span>
                                            {renderStatusPill(selectedLog.result.status, selectedLog.result.isAnomaly)}
                                        </div>
                                        <div className="mt-2">
                                            <p className="font-semibold text-gray-900 dark:text-white">
                                                {selectedLog.result.summary}
                                            </p>
                                            {selectedLog.result.error && (
                                                <p className="text-xs text-red-600 dark:text-red-400 font-mono mt-1 bg-red-100/60 dark:bg-red-900/40 p-2 rounded-lg">
                                                    错误详情: {selectedLog.result.error}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ℹ️ Historical Log Compatibility Notice */}
                            {selectedLog.what.legacyHint && (
                                <div className="p-4 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-xs">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-amber-950 dark:text-amber-100">历史版本日志说明</p>
                                        <p className="mt-1 text-amber-800 dark:text-amber-300 leading-relaxed">
                                            {selectedLog.what.legacyHint}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* 📸 Photos Proof Gallery Card */}
                            {(selectedLog.result.photos.length > 0 || selectedLog.result.hasMissingProofAlert) && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <Camera className="w-3.5 h-3.5 text-indigo-500" />
                                            📸 现场实拍照片与单据凭证 ({selectedLog.result.photos.length} 张)
                                        </h4>
                                        {selectedLog.result.photos.length > 0 && (
                                            <span className="text-[11px] text-gray-400">点击照片可全屏高清放大</span>
                                        )}
                                    </div>

                                    {selectedLog.result.photos.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-3">
                                            {selectedLog.result.photos.map((photo, idx) => (
                                                <div 
                                                    key={idx}
                                                    onClick={() => setPreviewPhotoUrl(photo)}
                                                    className="group relative rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 overflow-hidden cursor-pointer shadow-xs hover:shadow-md transition-all"
                                                >
                                                    <div className="aspect-4/3 w-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                                        <img 
                                                            src={photo} 
                                                            alt={`凭证照片 ${idx + 1}`}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                            onError={(e) => {
                                                                (e.target as HTMLElement).style.display = 'none';
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-medium backdrop-blur-2xs">
                                                        <ZoomIn className="w-4 h-4" />
                                                        <span>点击放大</span>
                                                    </div>
                                                    <div className="p-2 text-[11px] font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between bg-white/90 dark:bg-gray-800/90 border-t border-gray-100 dark:border-gray-700">
                                                        <span className="flex items-center gap-1">
                                                            <ImageIcon className="w-3 h-3 text-indigo-500" />
                                                            凭证 #{idx + 1}
                                                        </span>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                window.open(photo, '_blank');
                                                            }}
                                                            className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                                                            title="新标签页打开原图"
                                                        >
                                                            <ExternalLink className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                            <span>⚠️ 审计合规提醒：该现场业务操作未附带实拍单据或货物照片凭证。</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 📍 GPS Location & Maps Integration Card */}
                            {(selectedLog.where.gps || selectedLog.result.hasMissingProofAlert) && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <Navigation className="w-3.5 h-3.5 text-blue-500" />
                                        📍 现场 GPS 定位与地图核验 (Location & Map)
                                    </h4>

                                    {selectedLog.where.gps ? (
                                        <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/50 dark:from-blue-950/40 dark:to-indigo-950/30 p-4 rounded-xl border border-blue-200/70 dark:border-blue-800/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-600 text-white shadow-xs">
                                                        GPS 实时坐标
                                                    </span>
                                                    <span className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200">
                                                        {typeof selectedLog.where.gps === 'string' 
                                                            ? selectedLog.where.gps 
                                                            : `${selectedLog.where.gps.lat.toFixed(6)}, ${selectedLog.where.gps.lng.toFixed(6)}`}
                                                    </span>
                                                </div>
                                                {selectedLog.where.location && (
                                                    <p className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1 mt-0.5">
                                                        <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                                                        <span>目标地址/工厂: <strong>{selectedLog.where.location}</strong></span>
                                                    </p>
                                                )}
                                            </div>

                                            {selectedLog.where.mapsUrl && (
                                                <button
                                                    onClick={() => window.open(selectedLog.where.mapsUrl!, '_blank')}
                                                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition shrink-0 cursor-pointer"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                    在 Google Maps 打开查看
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                            <span>⚠️ 审计合规预警：该移动端送货/外勤操作未采集到有效 GPS 现场坐标。</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 📦 Items & Quantities Breakdown Card */}
                            {selectedLog.result.items && selectedLog.result.items.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <Package className="w-3.5 h-3.5 text-emerald-500" />
                                            📦 货物清单与数量明细 ({selectedLog.result.items.length} 项)
                                        </h4>
                                        {selectedLog.what.totalQtySummary && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                总计: {selectedLog.what.totalQtySummary}
                                            </span>
                                        )}
                                    </div>

                                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-xs">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50 dark:bg-gray-700/60 border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300 font-semibold">
                                                    <th className="px-3 py-2">编号 / SKU</th>
                                                    <th className="px-3 py-2">货物 / 物料名称</th>
                                                    <th className="px-3 py-2 text-right">原定数量</th>
                                                    <th className="px-3 py-2 text-right">实收/实装数量</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                                                {selectedLog.result.items.map((item, idx) => {
                                                    const targetQty = item.quantity ?? item.qty ?? item.oldQty ?? '-';
                                                    const confirmedQty = item.confirmedQty ?? item.qty ?? item.quantity ?? '-';
                                                    const hasQtyDiff = targetQty !== '-' && confirmedQty !== '-' && String(targetQty) !== String(confirmedQty);

                                                    return (
                                                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition">
                                                            <td className="px-3 py-2 font-mono text-[11px] text-gray-500">
                                                                {item.sku || `#${idx + 1}`}
                                                            </td>
                                                            <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                                                                {item.name || item.product || '商品明细'}
                                                                {item.screw && (
                                                                    <span className="ml-1.5 px-1 py-0.2 rounded text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                                                        {item.screw}螺杆
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">
                                                                {targetQty} {item.unit || ''}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-mono font-bold">
                                                                {hasQtyDiff ? (
                                                                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                                                                        ⚠️ {confirmedQty} {item.unit || ''}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-emerald-600 dark:text-emerald-400">
                                                                        {confirmedQty} {item.unit || ''}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Data Changes Diff View (if available) */}
                            {selectedLog.result.changes && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500" />
                                        数据变更对照 (Data Diff)
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
                                        <div>
                                            <span className="font-bold text-rose-600 dark:text-rose-400 block mb-1">修改前 (Before):</span>
                                            <pre className="p-2 bg-rose-50/60 dark:bg-rose-950/30 rounded-lg text-gray-700 dark:text-gray-300 font-mono overflow-x-auto text-[11px]">
                                                {JSON.stringify(selectedLog.result.changes.before || {}, null, 2)}
                                            </pre>
                                        </div>
                                        <div>
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-1">修改后 (After):</span>
                                            <pre className="p-2 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-lg text-gray-700 dark:text-gray-300 font-mono overflow-x-auto text-[11px]">
                                                {JSON.stringify(selectedLog.result.changes.after || {}, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Full Raw Details JSON View */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">完整原始详情 (Raw Details JSON)</h4>
                                    <button
                                        onClick={() => handleCopyJson(selectedLog.raw.details || {})}
                                        className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                        {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                        <span>{copiedJson ? '已复制 JSON' : '复制 JSON'}</span>
                                    </button>
                                </div>
                                <div className="bg-gray-900 text-gray-200 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-64 shadow-inner">
                                    <pre>{JSON.stringify(selectedLog.raw.details || {}, null, 2)}</pre>
                                </div>
                            </div>
                        </div>

                        {/* Drawer Footer */}
                        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/50 flex justify-end">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-xs font-semibold hover:bg-gray-800 transition"
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Fullscreen Photo Lightbox Modal */}
            {previewPhotoUrl && (
                <div 
                    onClick={() => setPreviewPhotoUrl(null)}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in"
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        className="relative max-w-4xl max-h-[90vh] bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl flex flex-col"
                    >
                        {/* Lightbox Header */}
                        <div className="px-4 py-3 bg-gray-950/80 border-b border-gray-800 flex justify-between items-center text-white text-xs">
                            <div className="flex items-center gap-2">
                                <Camera className="w-4 h-4 text-indigo-400" />
                                <span className="font-semibold">现场实拍高清照片凭证</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => window.open(previewPhotoUrl, '_blank')}
                                    className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs flex items-center gap-1.5 transition"
                                    title="在浏览器新窗口打开"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    新窗口打开原图
                                </button>
                                <button
                                    onClick={() => setPreviewPhotoUrl(null)}
                                    className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Lightbox Image Preview */}
                        <div className="p-2 flex items-center justify-center bg-black overflow-auto max-h-[80vh]">
                            <img 
                                src={previewPhotoUrl} 
                                alt="现场实拍凭证大图"
                                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg select-none"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActivityLogs;

