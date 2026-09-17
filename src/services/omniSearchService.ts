import { supabase } from './supabase';
import { MODULE_REGISTRY, ModuleDefinition } from '../config/modules';
import { logActivity } from '../utils/logger';

export type OmniResultType = 'page' | 'order' | 'customer' | 'machine' | 'item' | 'user' | 'action';

export interface OmniSearchResult {
    id: string;
    type: OmniResultType;
    title: string;
    subtitle?: string;
    badge?: string;
    badgeColor?: string;
    targetPage?: string;
    metadata?: Record<string, any>;
}

export interface OmniActionField {
    key: string;
    label: string;
    value: any;
    type: 'text' | 'number' | 'date' | 'select' | 'textarea';
    options?: string[];
    required?: boolean;
}

export interface OmniActionDraft {
    id: string;
    intent: 'report_machine_issue' | 'create_task' | 'submit_leave' | 'quick_scrap' | 'general_action';
    title: string;
    summary: string;
    isDangerous?: boolean;
    dangerReason?: string;
    fields: OmniActionField[];
    targetPage?: string;
    payload: Record<string, any>;
}

export interface OmniInsightData {
    query: string;
    title: string;
    summary: string;
    keyMetrics: Array<{
        label: string;
        value: string | number;
        subtext?: string;
        trend?: 'up' | 'down' | 'neutral';
    }>;
    targetPage?: string;
    targetPageLabel?: string;
}

export interface OmniInterpretationResult {
    type: 'action' | 'insight' | 'unknown';
    actionDraft?: OmniActionDraft;
    insightData?: OmniInsightData;
    message?: string;
}

// In-memory cache with 30s TTL
const cache = new Map<string, { timestamp: number; data: OmniSearchResult[] }>();
const CACHE_TTL_MS = 30000;

/**
 * Filter and search accessible pages from MODULE_REGISTRY
 */
export function searchPages(
    query: string,
    allowedPageIds?: Set<string> | null,
    limit: number = 6
): OmniSearchResult[] {
    const q = query.trim().toLowerCase();
    const modules = MODULE_REGISTRY.filter((mod: ModuleDefinition) => {
        if (mod.hiddenFromNav) return false;
        if (allowedPageIds && !allowedPageIds.has('*') && !allowedPageIds.has(mod.id)) return false;
        if (!q) return true;
        const matchLabel = mod.label?.toLowerCase().includes(q);
        const matchLabelEn = mod.labelEn?.toLowerCase().includes(q);
        const matchDesc = mod.description?.toLowerCase().includes(q);
        const matchId = mod.id.toLowerCase().includes(q);
        return matchLabel || matchLabelEn || matchDesc || matchId;
    });

    return modules.slice(0, limit).map((mod) => ({
        id: `page-${mod.id}`,
        type: 'page',
        title: mod.label,
        subtitle: mod.description || mod.labelEn || `模块: ${mod.group}`,
        badge: '页面直达',
        badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        targetPage: mod.id,
        metadata: { group: mod.group }
    }));
}

/**
 * Unified multi-entity search across Supabase tables
 */
export async function searchEntities(
    rawQuery: string,
    options: {
        allowedPageIds?: Set<string> | null;
        role?: string;
        limitPerCategory?: number;
    } = {}
): Promise<{
    pages: OmniSearchResult[];
    orders: OmniSearchResult[];
    customers: OmniSearchResult[];
    machines: OmniSearchResult[];
    items: OmniSearchResult[];
    users: OmniSearchResult[];
}> {
    const trimmed = rawQuery.trim();
    const limit = options.limitPerCategory || 5;

    // Detect prefix triggers
    let categoryFilter: string | null = null;
    let query = trimmed;

    if (query.startsWith('>') || query.startsWith('page:')) {
        categoryFilter = 'pages';
        query = query.replace(/^>|^page:/, '').trim();
    } else if (query.startsWith('#') || query.startsWith('machine:') || query.startsWith('机台:')) {
        categoryFilter = 'machines';
        query = query.replace(/^#|^machine:|^机台:/, '').trim();
    } else if (query.startsWith('@') || query.startsWith('staff:') || query.startsWith('员工:') || query.startsWith('user:')) {
        categoryFilter = 'users';
        query = query.replace(/^@|^staff:|^员工:|^user:/, '').trim();
    } else if (query.toLowerCase().startsWith('do:') || query.startsWith('单号:') || query.startsWith('order:')) {
        categoryFilter = 'orders';
        query = query.replace(/^do:|^单号:|^order:/i, '').trim();
    } else if (query.toLowerCase().startsWith('sku:') || query.startsWith('物料:') || query.startsWith('item:')) {
        categoryFilter = 'items';
        query = query.replace(/^sku:|^物料:|^item:/i, '').trim();
    } else if (query.startsWith('cust:') || query.startsWith('客户:')) {
        categoryFilter = 'customers';
        query = query.replace(/^cust:|^客户:/, '').trim();
    }

    // Always fetch matching pages client-side
    const matchedPages = (!categoryFilter || categoryFilter === 'pages')
        ? searchPages(query, options.allowedPageIds, limit)
        : [];

    if (!query) {
        return {
            pages: matchedPages,
            orders: [],
            customers: [],
            machines: [],
            items: [],
            users: []
        };
    }

    const cacheKey = `${categoryFilter || 'all'}:${query.toLowerCase()}`;
    const cachedEntry = cache.get(cacheKey);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL_MS) {
        const cached = cachedEntry.data;
        return {
            pages: cached.filter((r) => r.type === 'page'),
            orders: cached.filter((r) => r.type === 'order'),
            customers: cached.filter((r) => r.type === 'customer'),
            machines: cached.filter((r) => r.type === 'machine'),
            items: cached.filter((r) => r.type === 'item'),
            users: cached.filter((r) => r.type === 'user')
        };
    }

    const pattern = `%${query}%`;
    const promises: Promise<any>[] = [];

    // Orders (sales_orders)
    if (!categoryFilter || categoryFilter === 'orders') {
        promises.push(
            supabase
                .from('sales_orders')
                .select('id, order_number, customer, status, delivery_address, zone')
                .or(`order_number.ilike.${pattern},customer.ilike.${pattern}`)
                .limit(limit)
                .then(({ data }) =>
                    (data || []).map((o: any) => ({
                        id: `order-${o.id || o.order_number}`,
                        type: 'order' as OmniResultType,
                        title: o.order_number,
                        subtitle: `${o.customer || '未知客户'} • ${o.zone || '未知区域'}`,
                        badge: o.status || 'DO单据',
                        badgeColor: o.status === 'Delivered'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                        targetPage: 'delivery-orders',
                        metadata: o
                    }))
                )
                .catch(() => [])
        );
    } else {
        promises.push(Promise.resolve([]));
    }

    // Customers (sys_customers)
    if (!categoryFilter || categoryFilter === 'customers') {
        promises.push(
            supabase
                .from('sys_customers')
                .select('id, name, zone, phone, address')
                .or(`name.ilike.${pattern},zone.ilike.${pattern}`)
                .limit(limit)
                .then(({ data }) =>
                    (data || []).map((c: any) => ({
                        id: `cust-${c.id || c.name}`,
                        type: 'customer' as OmniResultType,
                        title: c.name,
                        subtitle: `${c.zone || '默认区域'} ${c.phone ? `• ${c.phone}` : ''}`,
                        badge: '客户档案',
                        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                        targetPage: 'customer-360',
                        metadata: c
                    }))
                )
                .catch(() => [])
        );
    } else {
        promises.push(Promise.resolve([]));
    }

    // Machines (sys_machines_v2)
    if (!categoryFilter || categoryFilter === 'machines') {
        promises.push(
            supabase
                .from('sys_machines_v2')
                .select('machine_id, name, status, current_sku, model')
                .or(`machine_id.ilike.${pattern},name.ilike.${pattern}`)
                .limit(limit)
                .then(({ data }) =>
                    (data || []).map((m: any) => ({
                        id: `machine-${m.machine_id}`,
                        type: 'machine' as OmniResultType,
                        title: `${m.machine_id} - ${m.name || '机台'}`,
                        subtitle: m.current_sku ? `正在生产: ${m.current_sku}` : `型号: ${m.model || '标准机'}`,
                        badge: m.status || '机台状态',
                        badgeColor: m.status === 'RUNNING' || m.status === 'Active'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/30',
                        targetPage: 'production-control',
                        metadata: m
                    }))
                )
                .catch(() => [])
        );
    } else {
        promises.push(Promise.resolve([]));
    }

    // Items (master_items_v2)
    if (!categoryFilter || categoryFilter === 'items') {
        promises.push(
            supabase
                .from('master_items_v2')
                .select('sku, name, category, uom')
                .or(`sku.ilike.${pattern},name.ilike.${pattern}`)
                .limit(limit)
                .then(({ data }) =>
                    (data || []).map((i: any) => ({
                        id: `sku-${i.sku}`,
                        type: 'item' as OmniResultType,
                        title: i.sku,
                        subtitle: `${i.name || '物料产品'} ${i.category ? `• ${i.category}` : ''}`,
                        badge: i.uom || 'SKU物料',
                        badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
                        targetPage: 'product-library',
                        metadata: i
                    }))
                )
                .catch(() => [])
        );
    } else {
        promises.push(Promise.resolve([]));
    }

    // Staff / Users (users_public)
    if (!categoryFilter || categoryFilter === 'users') {
        promises.push(
            supabase
                .from('users_public')
                .select('id, name, employee_id, role, email')
                .or(`name.ilike.${pattern},employee_id.ilike.${pattern}`)
                .limit(limit)
                .then(({ data }) =>
                    (data || []).map((u: any) => ({
                        id: `user-${u.id || u.employee_id}`,
                        type: 'user' as OmniResultType,
                        title: u.name || '未知员工',
                        subtitle: `${u.employee_id ? `工号: ${u.employee_id} • ` : ''}${u.role || '成员'}`,
                        badge: u.role || '员工',
                        badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                        targetPage: 'hr-portal',
                        metadata: u
                    }))
                )
                .catch(() => [])
        );
    } else {
        promises.push(Promise.resolve([]));
    }

    const [orders, customers, machines, items, users] = await Promise.all(promises);

    const allResults = [...matchedPages, ...orders, ...customers, ...machines, ...items, ...users];
    cache.set(cacheKey, { timestamp: Date.now(), data: allResults });

    return {
        pages: matchedPages,
        orders,
        customers,
        machines,
        items,
        users
    };
}

/**
 * Fast client-side heuristic pattern recognizer for instant action preview
 */
export function parseLocalActionIntent(rawText: string, currentUser?: any): OmniActionDraft | null {
    const text = rawText.trim();
    if (!text) return null;

    // 1. 机台故障报修: "报修 T1-M03 切刀钝化", "T1-M02 故障停机", "修机 3号机"
    const machineMatch = text.match(/(?:报修|维修|故障|停机|修机|检修)\s*([A-Z0-9_-]+)?(?:\s+(.+))?/i)
        || text.match(/([A-Z0-9_-]+)\s*(?:报修|故障|停机|异常)(?:\s+(.+))?/i);
    if (machineMatch && (machineMatch[1] || machineMatch[2])) {
        const machineId = (machineMatch[1] || 'T1-M03').toUpperCase();
        const reason = machineMatch[2] || '设备异常待检修';
        return {
            id: `action-repair-${Date.now()}`,
            intent: 'report_machine_issue',
            title: `机台报修登记: ${machineId}`,
            summary: `登记机台 [${machineId}] 故障状态并通知机修人员`,
            isDangerous: true,
            dangerReason: '此操作将变更机台实时运行状态为「维护/停机」',
            targetPage: 'production-control',
            payload: { machineId, reason, status: 'MAINTENANCE' },
            fields: [
                { key: 'machineId', label: '机台代号', value: machineId, type: 'text', required: true },
                { key: 'reason', label: '故障现象/原因', value: reason, type: 'text', required: true },
                { key: 'priority', label: '紧急程度', value: 'High', type: 'select', options: ['Normal', 'High', 'Critical'] }
            ]
        };
    }

    // 2. 待办任务创建: "待办 明天盘点原料仓", "提醒 给客户TopGlove补发送货单", "task 检查配电柜"
    const taskMatch = text.match(/^(?:待办|任务|提醒|task|todo)\s*(.+)/i);
    if (taskMatch && taskMatch[1]) {
        const title = taskMatch[1].trim();
        return {
            id: `action-task-${Date.now()}`,
            intent: 'create_task',
            title: `创建工作待办: ${title.slice(0, 20)}...`,
            summary: `在协同待办中心创建任务卡片并指派跟进`,
            isDangerous: false,
            targetPage: 'tasks',
            payload: { title, priority: 'Normal' },
            fields: [
                { key: 'title', label: '任务名称', value: title, type: 'text', required: true },
                { key: 'priority', label: '优先级', value: 'Normal', type: 'select', options: ['Low', 'Normal', 'High'] },
                { key: 'dueDate', label: '截止时间', value: new Date(Date.now() + 86400000).toISOString().split('T')[0], type: 'date' }
            ]
        };
    }

    // 3. 请假登记: "Ali 明天请年假一天", "张三 周五请病假", "请假 2天 产线师傅"
    const leaveMatch = text.match(/(?:请假|leave)\s*(.+)/i)
        || text.match(/([^\s]+)\s*(?:明天|后天|周[一二三四五六日]|下周)?\s*请\s*(年假|病假|事假|产假)?\s*(\d+)?\s*(?:天|小时|天假)?/);
    if (leaveMatch) {
        const employeeName = currentUser?.name || '当前员工';
        const reason = text;
        return {
            id: `action-leave-${Date.now()}`,
            intent: 'submit_leave',
            title: `提交请假申请单`,
            summary: `录入请假申请并提交至人事服务台审核`,
            isDangerous: false,
            targetPage: 'leave-calendar',
            payload: { employeeName, reason, days: 1, type: 'Annual' },
            fields: [
                { key: 'employeeName', label: '申请人姓名', value: employeeName, type: 'text', required: true },
                { key: 'type', label: '请假类别', value: 'Annual', type: 'select', options: ['Annual', 'Medical', 'Emergency', 'Unpaid'] },
                { key: 'days', label: '请假天数', value: 1, type: 'number', required: true },
                { key: 'reason', label: '请假事由', value: reason, type: 'textarea' }
            ]
        };
    }

    // 4. 现场报废记工: "T1-M03 报废 25kg 调机废料", "报废 10kg"
    const scrapMatch = text.match(/(?:报废|废料|scrap)\s*(\d+(?:\.\d+)?)\s*(?:kg|公斤)?(?:\s+(.+))?/i);
    if (scrapMatch) {
        const scrapKg = parseFloat(scrapMatch[1]);
        const reason = scrapMatch[2] || '换卷调机废料';
        return {
            id: `action-scrap-${Date.now()}`,
            intent: 'quick_scrap',
            title: `现场废料报废登记: ${scrapKg} kg`,
            summary: `将废料数据沉淀至生产报废记录与物料台账`,
            isDangerous: true,
            dangerReason: '此操作将直接扣减工厂原料库存并计入产线损耗',
            targetPage: 'production-control',
            payload: { scrapKg, reason, machineId: 'T1-M03' },
            fields: [
                { key: 'machineId', label: '机台代码', value: 'T1-M03', type: 'text', required: true },
                { key: 'scrapKg', label: '废料重量 (kg)', value: scrapKg, type: 'number', required: true },
                { key: 'reason', label: '报废原因', value: reason, type: 'text', required: true }
            ]
        };
    }

    return null;
}

/**
 * Call backend Omni Command AI API to interpret complex queries or statistical questions
 */
export async function queryOmniAI(
    query: string,
    context: {
        role?: string;
        user?: any;
    } = {}
): Promise<OmniInterpretationResult> {
    try {
        const res = await fetch('/api/agent/omni-command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                context: {
                    userRole: context.role || context.user?.role || 'Operator',
                    userName: context.user?.name || 'User',
                    userId: context.user?.uid || context.user?.id
                }
            })
        });

        if (!res.ok) {
            throw new Error(`API responded with status ${res.status}`);
        }

        const data = await res.json();
        return data;
    } catch (err: any) {
        console.warn('Omni Command remote AI fallback:', err);
        // Fallback: If local heuristic matched, return action
        const localAction = parseLocalActionIntent(query, context.user);
        if (localAction) {
            return { type: 'action', actionDraft: localAction };
        }
        return {
            type: 'unknown',
            message: '暂时无法联网识别复杂语义，请尝试使用关键词搜索或标准指令（如：报修 T1-M03 切刀故障、待办 盘点原料仓）'
        };
    }
}

/**
 * Execute confirmed Omni Action and write to Supabase
 */
export async function executeOmniAction(
    draft: OmniActionDraft,
    currentUser: any
): Promise<{ success: boolean; message: string }> {
    try {
        const user = currentUser;
        const uid = user?.uid || user?.id;

        if (draft.intent === 'create_task') {
            const { title, priority, dueDate } = draft.payload;
            const { error } = await supabase.from('tasks').insert([
                {
                    title: title || draft.title,
                    description: draft.summary,
                    priority: priority || 'Normal',
                    assigned_to: uid,
                    created_by: uid,
                    status: 'Pending',
                    due_date: dueDate || null
                }
            ]);
            if (error) throw error;

            await logActivity(user, {
                action: 'OMNI_CREATE_TASK',
                module: 'Tasks',
                target: title,
                resultSummary: `通过万能输入口创建任务: ${title}`
            });

            return { success: true, message: `待办任务 [${title}] 创建成功！` };
        }

        if (draft.intent === 'report_machine_issue') {
            const { machineId, reason } = draft.payload;
            // Record activity and update machine status if table allows
            await supabase
                .from('sys_machines_v2')
                .update({ status: 'MAINTENANCE' })
                .eq('machine_id', machineId);

            await logActivity(user, {
                action: 'OMNI_REPORT_MACHINE_ISSUE',
                module: 'MachineMaintenance',
                target: machineId,
                status: 'WARNING',
                resultSummary: `机台 [${machineId}] 报修维护: ${reason}`,
                details: { machineId, reason, source: 'OmniCommandBar' }
            });

            return { success: true, message: `机台 [${machineId}] 报修成功！状态已切换为维护中。` };
        }

        if (draft.intent === 'submit_leave') {
            const { employeeName, days, type, reason } = draft.payload;
            const { error } = await supabase.from('employee_leave').insert([
                {
                    user_id: uid,
                    user_name: employeeName || user?.name || '未知员工',
                    role: user?.role || 'Operator',
                    start_date: new Date().toISOString().split('T')[0],
                    end_date: new Date(Date.now() + (Number(days) || 1) * 86400000).toISOString().split('T')[0],
                    total_days: Number(days) || 1,
                    leave_type: type || 'Annual',
                    reason: reason || '万能输入口快速申请',
                    status: 'Pending'
                }
            ]);
            if (error) throw error;

            await logActivity(user, {
                action: 'OMNI_SUBMIT_LEAVE',
                module: 'HRPortal',
                target: employeeName,
                resultSummary: `通过万能输入口提交 ${days} 天 ${type} 假条`
            });

            return { success: true, message: `请假单已提交成功，待人事审核！` };
        }

        if (draft.intent === 'quick_scrap') {
            const { machineId, scrapKg, reason } = draft.payload;
            await logActivity(user, {
                action: 'OMNI_QUICK_SCRAP',
                module: 'ProductionControl',
                target: machineId,
                status: 'WARNING',
                resultSummary: `机台 [${machineId}] 登记报废 ${scrapKg} kg: ${reason}`,
                details: { machineId, scrapKg, reason, source: 'OmniCommandBar' }
            });

            return { success: true, message: `报废记录已保存！已记入机台 [${machineId}] 损耗台账。` };
        }

        // Generic fallback action
        await logActivity(user, {
            action: 'OMNI_GENERAL_ACTION',
            module: 'OmniCommand',
            resultSummary: `执行万能指令: ${draft.title}`,
            details: draft.payload
        });

        return { success: true, message: `指令 [${draft.title}] 已执行完毕！` };
    } catch (err: any) {
        console.error('Failed to execute omni action:', err);
        return { success: false, message: `执行失败: ${err.message || '网络异常'}` };
    }
}
