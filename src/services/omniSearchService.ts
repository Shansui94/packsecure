import { supabase } from './supabase';
import { MODULE_REGISTRY, ModuleDefinition } from '../config/modules';
import { logActivity } from '../utils/logger';

export type OmniResultType = 'page' | 'order' | 'customer' | 'machine' | 'item' | 'user' | 'action' | 'doc';

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

export interface OmniDocumentDraft {
    id: string;
    file?: File;
    fileName: string;
    fileUrl?: string;
    previewUrl: string;
    categoryKey: string;
    categoryLabel: string;
    confidenceScore: number;
    vendorName?: string;
    vehiclePlate?: string;
    matchedVehiclePlate?: string;
    isPlateMatched?: boolean;
    docDate?: string;
    dueDate?: string;
    totalAmount?: number;
    docNumber?: string;
    periodYear?: number;
    periodMonth?: number;
    subject?: string;
    notes?: string;
    sideEffects: {
        updateLorryInspection: boolean;
        createTask: boolean;
        createClaim: boolean;
        updateEmployeeLicense: boolean;
    };
    rawAiResponse?: any;
}

export interface OmniAnswerData {
    title: string;
    text: string;
    quickActions?: Array<{ label: string; query: string; icon?: string }>;
    targetPage?: string;
    targetPageLabel?: string;
}

export interface OmniInterpretationResult {
    type: 'action' | 'insight' | 'answer' | 'unknown';
    actionDraft?: OmniActionDraft;
    insightData?: OmniInsightData;
    answerData?: OmniAnswerData;
    message?: string;
}

// In-memory cache with 30s TTL
const cache = new Map<string, { timestamp: number; data: OmniSearchResult[] }>();
const CACHE_TTL_MS = 30000;

export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

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
        // Allow hidden pages to be found if the user explicitly searches for them
        if (mod.hiddenFromNav && !q) return false;
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
    docs: OmniSearchResult[];
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
    } else if (query.startsWith('doc:') || query.startsWith('file:') || query.startsWith('凭证:') || query.startsWith('文档:')) {
        categoryFilter = 'docs';
        query = query.replace(/^doc:|^file:|^凭证:|^文档:/, '').trim();
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
            users: [],
            docs: []
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
            users: cached.filter((r) => r.type === 'user'),
            docs: cached.filter((r) => r.type === 'doc')
        };
    }

    const pattern = `%${query}%`;
    const promises: Promise<any>[] = [];

    // Orders (sales_orders)
    if (!categoryFilter || categoryFilter === 'orders') {
        promises.push(
            Promise.resolve(
                supabase
                    .from('sales_orders')
                    .select('id, order_number, customer, status, delivery_address, zone')
                    .or(`order_number.ilike.${pattern},customer.ilike.${pattern}`)
                    .limit(limit)
            )
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
            Promise.resolve(
                supabase
                    .from('sys_customers')
                    .select('id, name, zone, phone, address')
                    .or(`name.ilike.${pattern},zone.ilike.${pattern}`)
                    .limit(limit)
            )
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

    // Machines (sys_machines)
    if (!categoryFilter || categoryFilter === 'machines') {
        promises.push(
            Promise.resolve(
                supabase
                    .from('sys_machines')
                    .select('machine_id, name, status, current_sku, model')
                    .or(`machine_id.ilike.${pattern},name.ilike.${pattern}`)
                    .limit(limit)
            )
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

    // Items (master_items)
    if (!categoryFilter || categoryFilter === 'items') {
        promises.push(
            Promise.resolve(
                supabase
                    .from('master_items')
                    .select('sku, name, category, uom')
                    .or(`sku.ilike.${pattern},name.ilike.${pattern}`)
                    .limit(limit)
            )
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
            Promise.resolve(
                supabase
                    .from('users_public')
                    .select('id, name, employee_id, role, email')
                    .or(`name.ilike.${pattern},employee_id.ilike.${pattern}`)
                    .limit(limit)
            )
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

    // Documents (extracted_documents)
    if (!categoryFilter || categoryFilter === 'docs') {
        promises.push(
            Promise.resolve(
                supabase
                    .from('extracted_documents')
                    .select('id, file_name, file_url, category_key, total_amount, doc_date, doc_number, vendor_name, vehicle_plate')
                    .or(`file_name.ilike.${pattern},vendor_name.ilike.${pattern},vehicle_plate.ilike.${pattern},category_key.ilike.${pattern}`)
                    .order('created_at', { ascending: false })
                    .limit(limit)
            )
                .then(({ data }) =>
                    (data || []).map((d: any) => ({
                        id: `doc-${d.id}`,
                        type: 'doc' as OmniResultType,
                        title: d.file_name,
                        subtitle: `${d.vendor_name ? `${d.vendor_name} • ` : ''}${d.vehicle_plate ? `车牌: ${d.vehicle_plate} • ` : ''}RM ${d.total_amount || 0}`,
                        badge: d.category_key || '凭证文档',
                        badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
                        targetPage: 'william-dashboard',
                        metadata: d
                    }))
                )
                .catch(() => [])
        );
    } else {
        promises.push(Promise.resolve([]));
    }

    const [orders, customers, machines, items, users, docs] = await Promise.all(promises);

    const allResults = [...matchedPages, ...orders, ...customers, ...machines, ...items, ...users, ...docs];
    cache.set(cacheKey, { timestamp: Date.now(), data: allResults });

    return {
        pages: matchedPages,
        orders,
        customers,
        machines,
        items,
        users,
        docs
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
 * Instant client-side greeting and operational helper recognizer
 */
export function checkLocalGreetingOrHelp(rawText: string, currentUser?: any): OmniAnswerData | null {
    const text = rawText.trim();
    if (!text) return null;

    const isGreeting = /^(?:你好|您好|hi|hello|嗨|早|早安|晚安|哈喽|在吗|hey|yo)/i.test(text);
    const isHelp = /^(?:帮助|help|指南|功能|你是谁|怎么用|能做什么|\?|？)/i.test(text);

    if (!isGreeting && !isHelp) return null;

    const userName = currentUser?.name || '同事';
    const userRole = currentUser?.role || '成员';

    return {
        title: `您好，${userName}！我是 Packsecure 智能协同助理 👋`,
        text: `我是工厂与仓储运营的 AI 助理（当前身份：${userRole}）。您可以在这个万能输入口随时进行：\n\n• **极速搜索**：输入 DO 单号、客户名、物料 SKU、机台或员工\n• **业务指令**：直接输入 “报修 T1-M03 切刀故障”、“待办 盘点原料仓”、“请假 明天年假1天”\n• **运营看板**：输入 “全厂设备稼动率”、“今日送货单概况” 秒出数据卡片\n• **凭证归档**：直接拖入或粘贴 (Ctrl+V) PUSPAKOM 验车单、官方公函、油票报销单`,
        quickActions: [
            { label: '🛠️ 报修机台 (T1-M03)', query: '报修 T1-M03 切刀钝化' },
            { label: '📋 新建协同待办', query: '待办 盘点原料仓库存' },
            { label: '🏖️ 申请年假', query: '请假 明天年假1天' },
            { label: '📊 查询设备稼动率', query: '全厂设备稼动率' },
            { label: '🚚 查询吉兰丹订单', query: '吉兰丹' },
            { label: '📎 凭证文档中心', query: 'doc: ' }
        ],
        targetPage: 'factory-live-os',
        targetPageLabel: '进入全厂实时看板 (Factory Live OS)'
    };
}

/**
 * Process document upload and run multi-modal AI extraction
 */
export async function processDocumentFile(
    file: File,
    currentUser: any
): Promise<OmniDocumentDraft> {
    const base64WithHeader = await fileToBase64(file);
    const fileName = file.name;
    const lowerName = fileName.toLowerCase();
    let resolvedMime = file.type;
    if (!resolvedMime) {
        if (lowerName.endsWith('.pdf')) resolvedMime = 'application/pdf';
        else if (lowerName.endsWith('.png')) resolvedMime = 'image/png';
        else if (lowerName.endsWith('.webp')) resolvedMime = 'image/webp';
        else resolvedMime = 'image/jpeg';
    }

    // Call API /api/v2/documents/process
    const res = await fetch('/api/v2/documents/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fileName,
            fileBase64: base64WithHeader,
            mimeType: resolvedMime,
            notes: `Uploaded via OmniCommandBar by ${currentUser?.name || 'User'}`
        })
    });

    if (!res.ok) {
        throw new Error(`Document processing failed with status ${res.status}`);
    }

    const json = await res.json();
    const ext = json.extractedData || {};

    // Check available lorries to verify plate match
    const { data: lorryList } = await supabase.from('lorries').select('id, plate_number');
    const rawPlate = (json.vehicle_plate || ext.vehicle_plate || '').toUpperCase().replace(/\s+/g, '');
    let matchedPlate = '';
    let isPlateMatched = false;

    if (rawPlate && lorryList) {
        const found = lorryList.find((l: any) => l.plate_number.toUpperCase().replace(/\s+/g, '') === rawPlate);
        if (found) {
            matchedPlate = found.plate_number;
            isPlateMatched = true;
        }
    }

    // Determine category key & label
    const rawCat = (json.category_key || ext.category_key || '').toUpperCase();
    let categoryKey = rawCat || 'UNASSIGNED';
    let categoryLabel = json.category_name || '待分类单据';

    // Smart Category Refinements based on content
    const textAll = `${fileName} ${ext.vendor_name || ''} ${ext.notes || ''} ${ext.doc_type || ''}`.toUpperCase();
    if (textAll.includes('PUSPAKOM') || textAll.includes('INSPECTION') || textAll.includes('LULUS')) {
        categoryKey = 'PUSPAKOM_INSURANCE';
        categoryLabel = 'PUSPAKOM 验车报告';
    } else if (textAll.includes('MAJLIS') || textAll.includes('BOMBA') || textAll.includes('NOTICE') || textAll.includes('SURAT') || textAll.includes('LETTER')) {
        categoryKey = 'GOVERNMENT_LETTER';
        categoryLabel = '政府公函 / 官方信件';
    } else if (textAll.includes('SSM') || textAll.includes('SURUHANJAYA') || textAll.includes('SYARIKAT')) {
        categoryKey = 'SSM_REGISTRATION';
        categoryLabel = 'SSM 商业注册证明';
    } else if (textAll.includes('SOCSO') || textAll.includes('PERKESO') || textAll.includes('KWSP') || textAll.includes('EPF')) {
        categoryKey = 'SOCSO_EPF';
        categoryLabel = 'SOCSO / EPF 缴费凭据';
    } else if (textAll.includes('LESEN') || textAll.includes('LICENSE') || textAll.includes('GDL')) {
        categoryKey = 'LICENSE';
        categoryLabel = '驾驶证 / 资质执照';
    } else if (textAll.includes('PETRONAS') || textAll.includes('SHELL') || textAll.includes('CALTEX') || textAll.includes('BHP')) {
        categoryKey = 'PETROL_FLEET';
        categoryLabel = '车队燃油收据 (Petrol)';
    }

    // Determine default side-effects
    const sideEffects = {
        updateLorryInspection: categoryKey === 'PUSPAKOM_INSURANCE',
        createTask: categoryKey === 'GOVERNMENT_LETTER' || !!ext.deadline,
        createClaim: categoryKey === 'PETROL_FLEET' || categoryKey === 'LORRY_SERVICE',
        updateEmployeeLicense: categoryKey === 'LICENSE'
    };

    return {
        id: json.documentId || `doc-${Date.now()}`,
        fileName,
        fileUrl: json.file_url,
        previewUrl: base64WithHeader,
        categoryKey,
        categoryLabel,
        confidenceScore: ext.confidence_score || 0.9,
        vendorName: json.vendor_name || ext.vendor_name || '',
        vehiclePlate: matchedPlate || json.vehicle_plate || ext.vehicle_plate || '',
        matchedVehiclePlate: matchedPlate,
        isPlateMatched,
        docDate: ext.doc_date || new Date().toISOString().split('T')[0],
        dueDate: ext.deadline || ext.due_date || (categoryKey === 'PUSPAKOM_INSURANCE' ? new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0] : ''),
        totalAmount: json.total_amount || ext.total_amount || 0,
        docNumber: ext.doc_number || '',
        periodYear: json.period_year || ext.period_year || new Date().getFullYear(),
        periodMonth: json.period_month || ext.period_month || new Date().getMonth() + 1,
        subject: ext.entity_name || ext.notes || fileName,
        notes: ext.notes || '',
        sideEffects,
        rawAiResponse: ext
    };
}

/**
 * Commit document draft and execute automated business side-effects
 */
export async function commitDocumentDraft(
    draft: OmniDocumentDraft,
    currentUser: any
): Promise<{ success: boolean; message: string }> {
    try {
        const uid = currentUser?.uid || currentUser?.id;
        const messages: string[] = [];

        // 1. Update extracted_documents record with final validated metadata
        if (draft.id) {
            await supabase.from('extracted_documents').update({
                category_key: draft.categoryKey,
                vendor_name: draft.vendorName || null,
                vehicle_plate: draft.vehiclePlate || null,
                total_amount: Number(draft.totalAmount) || 0,
                doc_date: draft.docDate || null,
                doc_number: draft.docNumber || null,
                notes: draft.notes || null,
                status: 'Dashboard_Updated',
                updated_at: new Date().toISOString()
            }).eq('id', draft.id);
        }

        messages.push(`文档 [${draft.fileName}] 归档成功`);

        // 2. Side-effect: Update Lorry Puspakom inspection
        if (draft.sideEffects.updateLorryInspection && draft.vehiclePlate) {
            const plateClean = draft.vehiclePlate.toUpperCase().replace(/\s+/g, '');
            const { data: lorries } = await supabase.from('lorries').select('id, plate_number');
            const targetLorry = (lorries || []).find((l: any) => l.plate_number.toUpperCase().replace(/\s+/g, '') === plateClean);
            if (targetLorry) {
                await supabase.from('lorry_mileage_logs').insert([{
                    lorry_id: targetLorry.id,
                    driver_id: uid,
                    log_type: 'service',
                    notes: `[PUSPAKOM 验车归档] 下次验车: ${draft.dueDate || '6个月后'} | 费用: RM ${draft.totalAmount}`,
                    photo_url: draft.fileUrl || null
                }]);
                messages.push(`已自动更新车辆 [${targetLorry.plate_number}] 验车维保记录`);
            }
        }

        // 3. Side-effect: Create Follow-up Task for Official Letters
        if (draft.sideEffects.createTask) {
            const due = draft.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
            await supabase.from('tasks').insert([{
                title: `[公函跟进] ${draft.vendorName || '官方机构'}: ${draft.subject || draft.docNumber || '合规通告'}`,
                description: `文件: ${draft.fileName}\n备注: ${draft.notes || '请在截止日期前完成回复与整改'}\n凭证链接: ${draft.fileUrl || ''}`,
                priority: 'High',
                assigned_to: uid,
                created_by: uid,
                status: 'Pending',
                due_date: due
            }]);
            messages.push(`已在待办中心创建高优先级截止日跟进任务 (到期日: ${due})`);
        }

        // 4. Side-effect: Create Claim entry for Petrol/Service
        if (draft.sideEffects.createClaim) {
            await supabase.from('driver_extra_tasks').insert([{
                driver_id: uid,
                category: draft.categoryKey === 'PETROL_FLEET' ? 'SHOPEE' : 'LORRY SERVICE',
                amount: Number(draft.totalAmount) || 0,
                photo_url: draft.fileUrl || '',
                notes: `[万能输入口报销] ${draft.vendorName || ''} | 车牌: ${draft.vehiclePlate || '未填'}`,
                status: 'Pending'
            }]);
            messages.push(`已自动创建费用报销申请 (金额: RM ${draft.totalAmount})`);
        }

        await logActivity(currentUser, {
            action: 'OMNI_COMMIT_DOCUMENT',
            module: 'WilliamDocumentCenter',
            target: draft.fileName,
            resultSummary: messages.join('； '),
            details: {
                categoryKey: draft.categoryKey,
                totalAmount: draft.totalAmount,
                vehiclePlate: draft.vehiclePlate
            }
        });

        return { success: true, message: messages.join('； ') };
    } catch (err: any) {
        console.error('commitDocumentDraft error:', err);
        return { success: false, message: `归档失败: ${err.message || '网络异常'}` };
    }
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
        // Fallback 1: If local greeting matched, return greeting answer
        const localGreeting = checkLocalGreetingOrHelp(query, context.user);
        if (localGreeting) {
            return { type: 'answer', answerData: localGreeting };
        }
        // Fallback 2: If local heuristic matched, return action
        const localAction = parseLocalActionIntent(query, context.user);
        if (localAction) {
            return { type: 'action', actionDraft: localAction };
        }
        // Fallback 3: Question assistance
        const isQuestion = /(?:怎么|如何|什么|哪|为什么|规则|流程|步骤|可以|能不能|how|what|why)/i.test(query);
        if (isQuestion) {
            return {
                type: 'answer',
                answerData: {
                    title: '业务与操作指引',
                    text: `针对您的提问 “**${query}**”：\n\n您可以使用万能指令分发业务：\n• **设备报修**：输入「报修 T1-M03 切刀故障」\n• **工作待办**：输入「待办 盘点原料仓」\n• **员工请假**：输入「请假 明天年假1天」\n• **单据搜索**：输入 DO 单号或客户名\n• **凭证归档**：拖入或粘贴 PUSPAKOM、油票、公函等\n\n点击下方按钮可前往 SOP 知识库或开启语音助理。`,
                    quickActions: [
                        { label: '🛠️ 报修机台', query: '报修 ' },
                        { label: '📋 新建待办', query: '待办 ' },
                        { label: '🏖️ 申请请假', query: '请假 ' },
                        { label: '📖 查看 SOP 知识库', query: 'SOP' }
                    ],
                    targetPage: 'sop-management',
                    targetPageLabel: '前往 SOP 知识库'
                }
            };
        }
        return {
            type: 'unknown',
            message: '未能精确识别该指令，您可输入关键词直接检索单据/客户，或使用如：“报修 T1-M03 切刀故障”、“待办 盘点成品仓” 等明确指令。'
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
            await supabase
                .from('sys_machines')
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
