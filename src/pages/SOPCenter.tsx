import { useState, useEffect, useMemo, useRef } from 'react';
import {
    BookOpen, Plus, Pencil, Trash2, X,
    ChevronLeft, FileText, Search, Save,
    Printer, CheckSquare, Square, ExternalLink,
    Sparkles, Bot, Play, LayoutGrid, List, Eye,
    AlertTriangle, Info, CheckCircle2, AlertCircle,
    Languages, Wrench, Truck, Boxes, Users, ShieldCheck,
    Factory, ChevronRight, Copy, Check, RotateCcw, FileCheck
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../services/supabase';
import { useTranslation } from "react-i18next";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SOPArticle {
    id: string;
    title: string;
    description: string;
    content: string;
    video_url?: string;
    page_id?: string;
    target_roles: string[];
    sort_order?: number;
    is_published: boolean;
    created_by?: string;
    created_at?: string;
    updated_at?: string;
    category?: string;
}

interface SOPCenterProps {
    userRole?: string;
    user?: any;
    onNavigate?: (page: string) => void;
}

const ALL_ROLES = ['SuperAdmin', 'Admin', 'Manager', 'Operator', 'Driver', 'HR'];

const ROLE_COLORS: Record<string, string> = {
    SuperAdmin: '#ef4444',
    Admin: '#3b82f6',
    Manager: '#8b5cf6',
    Operator: '#f59e0b',
    Driver: '#10b981',
    HR: '#ec4899',
};

// ─── System Page Directory for Deep-Linking ──────────────────────────────────
export const SYSTEM_PAGES = [
    { id: 'scanner', name: '生产控制台 (Production Workspace)', category: 'production' },
    { id: 'raw_material_mobile', name: '混料与多螺杆 (Material Mixing)', category: 'production' },
    { id: 'machine-schedule', name: '机台排程 (Machine Schedule)', category: 'production' },
    { id: 'machine-labels', name: '机器二维码标签 (Machine QR Labels)', category: 'equipment' },
    { id: 'floor-plan', name: '车间平面图 (Floor Plan)', category: 'production' },
    { id: 'recipes', name: '配方与AI学习 (Yield Control)', category: 'production' },
    { id: 'livestock', name: '实时成品库存 (Live Stock)', category: 'inventory' },
    { id: 'inventory', name: '全局库存清单 (Global Inventory)', category: 'inventory' },
    { id: 'stock-movement', name: '库存调拨 (Stock Movement)', category: 'inventory' },
    { id: 'stock-audit', name: '库存盘点 (Stock Audit)', category: 'inventory' },
    { id: 'audit-report', name: '盘点报告 (Audit Report)', category: 'inventory' },
    { id: 'products', name: '产品资料库 (Product Library)', category: 'inventory' },
    { id: 'delivery', name: '出货调度派车 (Trip Management)', category: 'logistics' },
    { id: 'delivery-driver', name: '司机端配送打卡 (Driver Portal)', category: 'logistics' },
    { id: 'delivery-history', name: '送货历史单据 (Delivery History)', category: 'logistics' },
    { id: 'order-summary', name: '每日配货看板 (Daily Prep)', category: 'logistics' },
    { id: 'lorry-service', name: '卡车维保记录 (Lorry Service)', category: 'equipment' },
    { id: 'maintenance', name: '综合维保管理 (Maintenance Control)', category: 'equipment' },
    { id: 'lorry-management', name: '车队资产档案 (Lorry Fleet)', category: 'logistics' },
    { id: 'leave-calendar', name: '员工请假中心 (Staff Hub)', category: 'hr' },
    { id: 'hr', name: 'HR 人事管理 (HR Control Center)', category: 'hr' },
    { id: 'work-photos', name: '工作拍照日志 (Work Photos)', category: 'production' },
    { id: 'activity-logs', name: '系统活动日志 (Activity Logs)', category: 'hr' },
    { id: 'tasks', name: '任务协作 (Tasks)', category: 'hr' },
    { id: 'notes', name: '便签与记事 (Notes)', category: 'hr' },
];

export const CATEGORIES = [
    { id: 'all', label: '全部规程', icon: BookOpen, color: 'text-indigo-400' },
    { id: 'production', label: '生产工艺', icon: Factory, color: 'text-amber-400' },
    { id: 'equipment', label: '设备维保', icon: Wrench, color: 'text-blue-400' },
    { id: 'logistics', label: '物流配送', icon: Truck, color: 'text-emerald-400' },
    { id: 'inventory', label: '仓储盘点', icon: Boxes, color: 'text-purple-400' },
    { id: 'hr', label: '人事行政', icon: Users, color: 'text-pink-400' },
    { id: 'safety', label: '品质安全', icon: ShieldCheck, color: 'text-red-400' },
];

// Helper to infer or assign category based on title, content, or page_id
function inferCategory(article: Partial<SOPArticle>): string {
    if (article.category) return article.category;
    const pid = article.page_id || '';
    if (['scanner', 'raw_material_mobile', 'recipes', 'floor-plan', 'work-photos'].includes(pid)) return 'production';
    if (['machine-labels', 'machine-schedule', 'lorry-service', 'maintenance'].includes(pid)) return 'equipment';
    if (['delivery', 'delivery-driver', 'delivery-history', 'order-summary', 'lorry-management'].includes(pid)) return 'logistics';
    if (['inventory', 'livestock', 'stock-movement', 'stock-audit', 'audit-report', 'products'].includes(pid)) return 'inventory';
    if (['leave-calendar', 'hr', 'activity-logs', 'tasks', 'notes'].includes(pid)) return 'hr';

    const text = ((article.title || '') + ' ' + (article.description || '') + ' ' + (article.content || '')).toLowerCase();
    if (/安全|防护|ppe|急停|危险|hazard|safety|kemalangan/i.test(text)) return 'safety';
    if (/卡车|司机|送货|交单|lorry|driver|penghantaran|drop|trip/i.test(text)) return 'logistics';
    if (/请假|假期|hr|cuti|leave|报销|claim|attendance|考勤/i.test(text)) return 'hr';
    if (/机器|机台|设备|调整|换卷|螺杆|气泡膜|bubblewrap|stretch|拉伸膜|mesin|line/i.test(text)) return 'production';
    if (/维修|保养|标签|servis|maintenance|label|qr/i.test(text)) return 'equipment';
    if (/库存|盘点|调拨|stok|inventory|warehouse/i.test(text)) return 'inventory';

    return 'production';
}

// ─── Industry SOP Templates ──────────────────────────────────────────────────
const SOP_TEMPLATES = [
    {
        name: '⚙️ 设备标准操作规程 (Machine Operating SOP)',
        template: `# 设备标准操作规程 (Standard Operating Procedure)

> [!NOTE]
> 本规程适用于工厂机台的标准开机、生产巡检与停机交接作业，确保操作合规与产出品质稳定。

---

## 1. 作业准备与安全检查 (Pre-check)
1. **劳保用品 (PPE)**：作业人员必须佩戴防护手套、安全鞋及耳塞。
2. **设备状态确认**：
   - 检查急停按钮 (E-Stop) 是否灵敏复位。
   - 检查机身接地线与温控仪表显示是否正常。
   - 确认模头与辊筒表面无异物附着。

> [!WARNING]
> 严禁在机械运转中将手伸入加热区或高速牵引辊之间！如遇卡料，必须先按下急停并切断动力源。

---

## 2. 标准开机步骤 (Operating Steps)
1. **系统扫码上岗**：使用手机 PackSecure 打开生产控制台，扫描当前机台专属二维码完成人员报工。
2. **预热升温**：设定温控仪表至目标工艺温度（1区/2区/3区），待达到设定值并保温 15 分钟。
3. **低速引料**：启动主电机低速旋转，观察出料塑化状态，缓慢提升牵引速度。
4. **首件检验**：测量首卷成品宽度、厚度公差与气泡饱满度，合格后方可全速批量生产。

---

## 3. 生产异常处置 (Troubleshooting)
| 常见现象 | 可能原因 | 排除对策 |
| :--- | :--- | :--- |
| 厚薄不均 | 模唇间隙不一 / 局部风环堵塞 | 调整微调螺栓，清理风环风槽 |
| 表面晶点/焦料 | 原料混有杂质 / 局部过热 | 停机清理螺杆，校准加热圈电热偶 |
| 卷取打皱 | 牵引张力过小 / 展平辊角度偏移 | 微调磁粉制动张力，校正展平辊 |

---

## 4. 交接班与收工规范 (Handover)
- [ ] 清理机台周边碎料并回收到对应料框
- [ ] 在 PackSecure 提交本日产量并记录异常备注
- [ ] 模温机降温至安全温度后关闭主电源
`
    },
    {
        name: '🚚 司机配送与回厂还车规范 (Driver Delivery & Return)',
        template: `# 司机送货打卡与交单还车 SOP (Driver Delivery Standard)
### Prosedur Operasi Standard Penghantaran & Pemulangan Lori

> [!IMPORTANT]
> 司机每日开工必须扫码绑定卡车，并在每站送达后完成【DO 纸质单签字照】与【现场货物照】双重拍照上传。

---

## 1. 流程简图 / Aliran Kerja
\`\`\`
[1. 扫车上QR绑定卡车] ➔ [2. 依次送达客户并拍照提交] ➔ [3. 回厂交单并扫车内QR还车]
\`\`\`

---

## 2. 核心操作步骤 / Langkah Operasi
### 步骤一：开工绑定车辆 / Langkah 1: Tambat Lori
1. 打开手机端 **My Deliveries** 模块。
2. 点击顶部 **「扫码绑定卡车 / Imbas QR Lori」**，对准驾驶室仪表盘上的车牌 QR 码。
3. 确认手机顶部横幅变绿，并显示正确车牌号码。

### 步骤二：客户点卸货与凭证上传 / Langkah 2: Hantar & Muat Naik Foto
1. 送达指定客户地点后，在订单列表中点开对应行单。
2. **拍照上传双凭证**：
   - **BUNYIK DO**：拍摄客户盖章且签字的送货单全貌（字迹清晰完整）。
   - **BUKTI BARANG**：拍摄货物放置在客户仓库或收货区的现场清晰照片。
3. 点击底部的 **「SUBMIT THIS DROP POINT / 提交此站」** 按钮确认完成。

> [!WARNING]
> 送货途中不要点击任何“结束行程”按钮！全部站点送完后直接开车返回 Taiping 厂区。

### 步骤三：回厂交单与扫码收工 / Langkah 3: Balik & Imbas Tamat
1. 前往文员办公室，将客户签署的全部纸质 DO 交付给相关文员。
2. 在手机顶部蓝色卡车条中点击 **「TAMAT SYIF / END SHIFT」**。
3. 再次扫描卡车仪表盘上的同一个二维码，系统自动将所有单据归档结单并释放卡车。
`
    },
    {
        name: '🛡️ 车间安全生产与 PPE 防护规范 (Safety & PPE Protocol)',
        template: `# 车间安全生产与劳动防护守则 (Safety & PPE Protocol)

> [!CAUTION]
> 安全第一，预防为主！进入工厂生产区域，必须时刻遵守以下人身安全与设备安全红线！

---

## 1. 劳保防护装备 (PPE 要求)
所有进入车间作业人员（含机修、巡检与装卸人员），必须严格穿戴：
- 🥾 **防砸防穿刺劳保鞋**（严禁穿拖鞋、凉鞋或布鞋）
- 🧤 **耐磨防割或防烫手套**（操作旋转运动部件时禁用棉纱线手套）
- 🦺 **反光安全马甲**（仓库区及叉车通道内必须穿戴）
- 🎧 **防噪音耳塞/耳罩**（高分贝机台区作业时佩戴）

---

## 2. 设备六大安全禁令
1. **严禁带电检修**：设备电气故障必须由专职电工执行“断电挂牌上锁 (LOTO)”流程。
2. **严禁旁路安全门**：禁止私自拆卸或短接光栅传感器与安全连锁装置。
3. **严禁运转中清灰**：机器未完全停稳前，禁止用毛刷或抹布清理辊筒夹缝。
4. **急停开关不可阻挡**：各机台前后急停按钮周围 1 米内严禁堆放原材料或托盘。

> [!TIP]
> 发现任何漏油、冒烟或异响，立即按下就近的红色急停开关 (E-Stop)，并使用 PackSecure 系统上报停机报警！
`
    }
];

// ─── Custom Markdown Renderer Components ─────────────────────────────────────
const MarkdownComponents = {
    // Custom heading with id for smooth scrolling TOC
    h1: ({ node, children, ...props }: any) => {
        const text = String(children);
        const id = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-');
        return <h1 id={id} className="text-2xl font-black text-white mt-8 mb-4 pb-2 border-b border-gray-800 flex items-center gap-2" {...props}>{children}</h1>;
    },
    h2: ({ node, children, ...props }: any) => {
        const text = String(children);
        const id = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-');
        return <h2 id={id} className="text-xl font-extrabold text-indigo-300 mt-7 mb-3 flex items-center gap-2" {...props}>{children}</h2>;
    },
    h3: ({ node, children, ...props }: any) => {
        const text = String(children);
        const id = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-');
        return <h3 id={id} className="text-base font-bold text-gray-200 mt-5 mb-2" {...props}>{children}</h3>;
    },
    // GitHub Style Alert blockquotes
    blockquote: ({ node, children, ...props }: any) => {
        const childArray = Array.isArray(children) ? children : [children];
        // Examine text content for alert tag
        const flatText = childArray.map(c => typeof c === 'string' ? c : (c?.props?.children || '')).join('');

        if (flatText.includes('[!NOTE]')) {
            return (
                <div className="my-4 rounded-xl border border-blue-500/30 bg-blue-950/20 p-4 text-blue-200 text-sm flex gap-3 shadow-md shadow-blue-500/5">
                    <Info size={20} className="text-blue-400 shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium leading-relaxed prose-invert">{children}</div>
                </div>
            );
        }
        if (flatText.includes('[!TIP]')) {
            return (
                <div className="my-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-emerald-200 text-sm flex gap-3 shadow-md shadow-emerald-500/5">
                    <Sparkles size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium leading-relaxed">{children}</div>
                </div>
            );
        }
        if (flatText.includes('[!IMPORTANT]')) {
            return (
                <div className="my-4 rounded-xl border border-purple-500/30 bg-purple-950/20 p-4 text-purple-200 text-sm flex gap-3 shadow-md shadow-purple-500/5">
                    <AlertCircle size={20} className="text-purple-400 shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium leading-relaxed">{children}</div>
                </div>
            );
        }
        if (flatText.includes('[!WARNING]')) {
            return (
                <div className="my-4 rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-amber-200 text-sm flex gap-3 shadow-md shadow-amber-500/5">
                    <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium leading-relaxed">{children}</div>
                </div>
            );
        }
        if (flatText.includes('[!CAUTION]')) {
            return (
                <div className="my-4 rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-red-200 text-sm flex gap-3 shadow-md shadow-red-500/5">
                    <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium leading-relaxed">{children}</div>
                </div>
            );
        }

        return (
            <blockquote className="my-4 border-l-4 border-indigo-500 bg-gray-900/40 px-4 py-2 text-gray-300 text-sm italic rounded-r-xl" {...props}>
                {children}
            </blockquote>
        );
    },
    // Tables
    table: ({ node, children, ...props }: any) => (
        <div className="overflow-x-auto my-5 rounded-xl border border-gray-800 bg-gray-950/60 shadow-inner">
            <table className="min-w-full divide-y divide-gray-800 text-sm text-left text-gray-300" {...props}>
                {children}
            </table>
        </div>
    ),
    th: ({ node, children, ...props }: any) => (
        <th className="px-4 py-3 bg-gray-900/80 font-black text-gray-200 text-xs tracking-wider uppercase" {...props}>
            {children}
        </th>
    ),
    td: ({ node, children, ...props }: any) => (
        <td className="px-4 py-3 border-t border-gray-800/60 text-xs leading-relaxed" {...props}>
            {children}
        </td>
    ),
    // Lists
    ul: ({ node, children, ...props }: any) => <ul className="list-disc ml-5 space-y-1 my-2 text-gray-300 text-sm" {...props}>{children}</ul>,
    ol: ({ node, children, ...props }: any) => <ol className="list-decimal ml-5 space-y-1.5 my-2 text-gray-300 text-sm" {...props}>{children}</ol>,
    li: ({ node, children, ...props }: any) => <li className="leading-relaxed" {...props}>{children}</li>,
    p: ({ node, children, ...props }: any) => {
        // Clean out raw alert markers if inside p
        const str = String(children);
        if (str.startsWith('[!NOTE]') || str.startsWith('[!TIP]') || str.startsWith('[!IMPORTANT]') || str.startsWith('[!WARNING]') || str.startsWith('[!CAUTION]')) {
            const clean = str.replace(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/, '');
            return <p className="mb-2 leading-relaxed text-gray-200">{clean}</p>;
        }
        return <p className="mb-3 leading-relaxed text-gray-300 text-sm" {...props}>{children}</p>;
    },
    code: ({ node, inline, children, ...props }: any) => {
        if (inline) {
            return <code className="px-1.5 py-0.5 rounded bg-gray-800/80 border border-gray-700/60 text-indigo-300 font-mono text-xs" {...props}>{children}</code>;
        }
        return (
            <div className="relative my-4 rounded-xl overflow-hidden border border-gray-800 bg-gray-950 font-mono text-xs">
                <pre className="p-4 text-gray-300 overflow-x-auto leading-relaxed">{children}</pre>
            </div>
        );
    },
    hr: () => <hr className="my-6 border-gray-800/80" />,
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SOPCenter({ userRole, user, onNavigate }: SOPCenterProps) {
    const { t } = useTranslation();
    const [articles, setArticles] = useState<SOPArticle[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter states
    const [searchTerm, setSearchTerm] = useState(() => {
        const stored = localStorage.getItem('sop_center_search_term');
        if (stored) {
            localStorage.removeItem('sop_center_search_term');
            return stored;
        }
        return '';
    });
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [roleFilter, setRoleFilter] = useState<string>('All');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Detail & Mode states
    const [selectedArticle, setSelectedArticle] = useState<SOPArticle | null>(null);
    const [isChecklistMode, setIsChecklistMode] = useState(false);
    const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({});

    // Admin Editor states
    const [isEditing, setIsEditing] = useState(false);
    const [editArticle, setEditArticle] = useState<Partial<SOPArticle> | null>(null);
    const [editorTab, setEditorTab] = useState<'write' | 'split' | 'preview'>('split');

    // Executive AI Assistant States
    const [showAIModal, setShowAIModal] = useState(false);
    const [aiAction, setAiAction] = useState<'generate' | 'polish' | 'safety_alerts' | 'translate' | 'checklist'>('generate');
    const [aiTopic, setAiTopic] = useState('');
    const [aiLanguage, setAiLanguage] = useState<'zh' | 'zh-bm' | 'zh-en'>('zh');
    const [aiSopType, setAiSopType] = useState('standard');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiResult, setAiResult] = useState<any | null>(null);
    const [copiedContent, setCopiedContent] = useState(false);

    const isAdmin = userRole === 'SuperAdmin' || userRole === 'Admin' || user?.employeeId === '001';

    useEffect(() => {
        loadArticles();
    }, []);

    // Load articles from Supabase
    const loadArticles = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('sop_articles')
                .select('*')
                .order('sort_order', { ascending: true });

            if (!error && data) {
                // Attach inferred category
                const enhanced = data.map((art: any) => ({
                    ...art,
                    category: inferCategory(art)
                }));
                setArticles(enhanced);
            }
        } catch (err) {
            console.error('Failed to load SOP articles:', err);
        } finally {
            setLoading(false);
        }
    };

    // Filter visible articles according to user permissions & filters
    const filteredArticles = useMemo(() => {
        return articles.filter(a => {
            // 1. Permissions
            if (!isAdmin) {
                if (!a.is_published) return false;
                if (a.target_roles && a.target_roles.length > 0 && userRole && !a.target_roles.includes(userRole)) {
                    return false;
                }
            }

            // 2. Role Filter Tab
            if (roleFilter !== 'All') {
                if (!a.target_roles || !a.target_roles.includes(roleFilter)) return false;
            }

            // 3. Category Tab
            if (selectedCategory !== 'all') {
                if (a.category !== selectedCategory) return false;
            }

            // 4. Search Keyword
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                const matchTitle = (a.title || '').toLowerCase().includes(q);
                const matchDesc = (a.description || '').toLowerCase().includes(q);
                const matchPage = (a.page_id || '').toLowerCase().includes(q);
                const matchContent = (a.content || '').toLowerCase().includes(q);
                return matchTitle || matchDesc || matchPage || matchContent;
            }

            return true;
        });
    }, [articles, isAdmin, userRole, roleFilter, selectedCategory, searchTerm]);

    // Statistics counts
    const stats = useMemo(() => {
        const total = articles.length;
        const published = articles.filter(a => a.is_published).length;
        const forMyRole = userRole ? articles.filter(a => !a.target_roles || a.target_roles.length === 0 || a.target_roles.includes(userRole)).length : total;
        const withPages = articles.filter(a => a.page_id && a.page_id.trim()).length;
        return { total, published, forMyRole, withPages };
    }, [articles, userRole]);

    // Parse TOC headings from article content
    const tableOfContents = useMemo(() => {
        if (!selectedArticle?.content) return [];
        const lines = selectedArticle.content.split('\n');
        const headings: { level: number; text: string; id: string }[] = [];

        lines.forEach(line => {
            const h1Match = line.match(/^#\s+(.+)$/);
            const h2Match = line.match(/^##\s+(.+)$/);
            const h3Match = line.match(/^###\s+(.+)$/);

            if (h1Match) {
                const text = h1Match[1].trim();
                headings.push({ level: 1, text, id: text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-') });
            } else if (h2Match) {
                const text = h2Match[1].trim();
                headings.push({ level: 2, text, id: text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-') });
            } else if (h3Match) {
                const text = h3Match[1].trim();
                headings.push({ level: 3, text, id: text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-') });
            }
        });

        return headings;
    }, [selectedArticle]);

    // Parse checklist tasks from article content for Checklist Mode
    const checklistItems = useMemo(() => {
        if (!selectedArticle?.content) return [];
        const lines = selectedArticle.content.split('\n');
        const items: string[] = [];

        lines.forEach(line => {
            const trimmed = line.trim();
            // Match markdown checkboxes "- [ ]" or numbered steps
            if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
                items.push(trimmed.replace(/^-\s*\[[ xX]\]\s*/, ''));
            } else if (/^(步骤\s*[一二三四五六七八九十0-9]+|Langkah\s*\d+|Step\s*\d+)[：:]/i.test(trimmed)) {
                items.push(trimmed);
            } else if (/^\d+\.\s+/.test(trimmed) && trimmed.length > 5 && !trimmed.includes('|')) {
                items.push(trimmed.replace(/^\d+\.\s+/, ''));
            }
        });

        return items;
    }, [selectedArticle]);

    // Handle interactive checklist toggle
    const handleToggleTask = (task: string) => {
        if (!selectedArticle) return;
        const key = `${selectedArticle.id}-${task}`;
        setCheckedTasks(prev => {
            const next = { ...prev, [key]: !prev[key] };
            try {
                localStorage.setItem(`sop_checklist_${selectedArticle.id}`, JSON.stringify(next));
            } catch (e) { }
            return next;
        });
    };

    // Load saved checklist on article select
    useEffect(() => {
        if (selectedArticle) {
            try {
                const saved = localStorage.getItem(`sop_checklist_${selectedArticle.id}`);
                if (saved) setCheckedTasks(JSON.parse(saved));
                else setCheckedTasks({});
            } catch (e) { }
        }
    }, [selectedArticle]);

    // ─── CRUD Actions ─────────────────────────────────────────────────────────
    const handleCreate = () => {
        setEditArticle({
            title: '',
            description: '',
            content: '',
            video_url: '',
            page_id: '',
            target_roles: [],
            sort_order: articles.length + 1,
            is_published: true,
            created_by: user?.name || 'Admin',
            category: 'production'
        });
        setEditorTab('split');
        setIsEditing(true);
    };

    const handleEdit = (article: SOPArticle) => {
        setEditArticle({ ...article });
        setEditorTab('split');
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!editArticle?.title) {
            alert(t('Please enter SOP Title'));
            return;
        }

        try {
            if (editArticle.id) {
                // Update
                const { error } = await supabase
                    .from('sop_articles')
                    .update({
                        title: editArticle.title,
                        description: editArticle.description || '',
                        content: editArticle.content || '',
                        video_url: editArticle.video_url || '',
                        page_id: editArticle.page_id || '',
                        target_roles: editArticle.target_roles || [],
                        sort_order: editArticle.sort_order || 0,
                        is_published: editArticle.is_published ?? true,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editArticle.id);

                if (error) throw error;
            } else {
                // Insert
                const { error } = await supabase
                    .from('sop_articles')
                    .insert({
                        title: editArticle.title,
                        description: editArticle.description || '',
                        content: editArticle.content || '',
                        video_url: editArticle.video_url || '',
                        page_id: editArticle.page_id || '',
                        target_roles: editArticle.target_roles || [],
                        sort_order: editArticle.sort_order || 0,
                        is_published: editArticle.is_published ?? true,
                        created_by: editArticle.created_by || user?.name || 'Admin',
                    });

                if (error) throw error;
            }

            setIsEditing(false);
            setEditArticle(null);
            loadArticles();
        } catch (err: any) {
            alert(t('Save failed: ') + err.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('Are you sure you want to delete this SOP? This cannot be undone.'))) return;
        await supabase.from('sop_articles').delete().eq('id', id);
        loadArticles();
        if (selectedArticle?.id === id) setSelectedArticle(null);
    };

    // ─── Executive AI Co-Pilot Calls ──────────────────────────────────────────
    const handleRunAIAssistant = async (actionType?: typeof aiAction) => {
        const action = actionType || aiAction;
        setAiLoading(true);
        setAiResult(null);

        try {
            const payload = {
                action: action,
                topic: aiTopic,
                existingContent: editArticle?.content || selectedArticle?.content || '',
                language: aiLanguage,
                sopType: aiSopType,
                category: editArticle?.category || 'production',
                targetRoles: editArticle?.target_roles || [],
                pageId: editArticle?.page_id || ''
            };

            const resp = await fetch('/api/agent/sop-assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!resp.ok) {
                const text = await resp.text();
                let errMsg = `服务响应异常 (${resp.status})`;
                try {
                    const parsed = JSON.parse(text);
                    if (parsed.error) errMsg = parsed.error;
                } catch {
                    if (text.includes('Cannot POST') || resp.status === 404) {
                        errMsg = '后端 API 路由未加载 (404)，请重启后端服务或刷新页面。';
                    }
                }
                throw new Error(errMsg);
            }

            const json = await resp.json();
            if (!json.success) throw new Error(json.error || 'AI generation failed');

            setAiResult(json.data);
        } catch (err: any) {
            alert('AI 辅助调用失败: ' + err.message);
        } finally {
            setAiLoading(false);
        }
    };

    // Apply AI draft into editor
    const handleApplyAIResult = (mode: 'replace' | 'append') => {
        if (!aiResult) return;

        if (!isEditing) {
            // Open editor with AI result
            setEditArticle({
                title: aiResult.title || aiTopic,
                description: aiResult.description || '',
                content: aiResult.content || '',
                target_roles: aiResult.suggested_roles || ['Operator', 'Manager'],
                page_id: aiResult.suggested_page_id || '',
                category: aiResult.category || 'production',
                is_published: true,
                sort_order: articles.length + 1
            });
            setIsEditing(true);
        } else {
            // Already editing
            setEditArticle(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    title: mode === 'replace' ? (aiResult.title || prev.title) : prev.title,
                    description: mode === 'replace' ? (aiResult.description || prev.description) : prev.description,
                    content: mode === 'replace'
                        ? aiResult.content
                        : `${prev.content || ''}\n\n---\n\n${aiResult.content}`,
                    target_roles: prev.target_roles?.length ? prev.target_roles : (aiResult.suggested_roles || prev.target_roles),
                    page_id: prev.page_id ? prev.page_id : (aiResult.suggested_page_id || prev.page_id),
                    category: aiResult.category || prev.category
                };
            });
        }

        setShowAIModal(false);
        setAiResult(null);
    };

    // Render YouTube or Video Embed
    const renderVideoPlayer = (url: string) => {
        if (!url) return null;

        // Check if YouTube
        const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
        if (ytMatch) {
            return (
                <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-indigo-500/20 shadow-xl bg-black my-6">
                    <iframe
                        src={`https://www.youtube.com/embed/${ytMatch[1]}`}
                        title="SOP Video"
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                </div>
            );
        }

        // Direct video link
        return (
            <div className="my-6 rounded-2xl overflow-hidden border border-gray-800 bg-black">
                <video controls className="w-full aspect-video">
                    <source src={url} />
                    {t('Your browser does not support playing this video.')}
                </video>
            </div>
        );
    };

    // ─── Print View Handler ───────────────────────────────────────────────────
    const handlePrint = () => {
        window.print();
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. ARTICLE DETAIL VIEW
    // ═══════════════════════════════════════════════════════════════════════════
    if (selectedArticle) {
        const associatedPage = SYSTEM_PAGES.find(p => p.id === selectedArticle.page_id);
        const checkedCount = checklistItems.filter(item => checkedTasks[`${selectedArticle.id}-${item}`]).length;
        const progressPct = checklistItems.length > 0 ? Math.round((checkedCount / checklistItems.length) * 100) : 0;

        return (
            <div className="h-full flex flex-col overflow-hidden bg-gray-950">
                {/* Print Header (Visible ONLY when printing) */}
                <div className="hidden print:block p-8 border-b-2 border-black text-black">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-black tracking-tight">PACKSECURE OS</h1>
                            <p className="text-xs uppercase tracking-widest text-gray-600 font-mono mt-1">车间标准作业规程 (Standard Operating Procedure)</p>
                        </div>
                        <div className="text-right text-xs font-mono">
                            <p>DOC ID: {selectedArticle.id.slice(0, 8).toUpperCase()}</p>
                            <p>UPDATE: {new Date(selectedArticle.updated_at || Date.now()).toLocaleDateString()}</p>
                            <p>ROLES: {selectedArticle.target_roles.join(', ') || 'ALL'}</p>
                        </div>
                    </div>
                </div>

                {/* Interactive Top Navbar (Hidden when printing) */}
                <div className="print:hidden flex-shrink-0 px-6 py-4 border-b border-gray-800/80 bg-gray-950/90 backdrop-blur-xl flex items-center justify-between z-10 shadow-lg">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSelectedArticle(null)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 hover:text-white hover:border-gray-700 transition-all font-bold text-xs shadow-sm hover:scale-105 active:scale-95"
                        >
                            <ChevronLeft size={16} />
                            {t('返回规程列表')}
                        </button>

                        <div className="h-4 w-px bg-gray-800" />

                        {/* View / Checklist Toggle */}
                        <div className="flex items-center bg-gray-900 border border-gray-800 rounded-xl p-1">
                            <button
                                onClick={() => setIsChecklistMode(false)}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${!isChecklistMode ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                            >
                                <BookOpen size={14} />
                                {t('完整阅读')}
                            </button>
                            <button
                                onClick={() => setIsChecklistMode(true)}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${isChecklistMode ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                            >
                                <CheckSquare size={14} />
                                {t('实操核对模式')}
                                {checklistItems.length > 0 && (
                                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-900/60 text-[10px]">
                                        {checkedCount}/{checklistItems.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        {/* Deep Link to Associated Feature */}
                        {selectedArticle.page_id && onNavigate && (
                            <button
                                onClick={() => onNavigate(selectedArticle.page_id!)}
                                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
                            >
                                <ExternalLink size={14} />
                                <span>{t('前往关联功能')}</span>
                                {associatedPage && <span className="opacity-80 text-[11px]">({associatedPage.name.split(' ')[0]})</span>}
                            </button>
                        )}

                        {/* Print Button */}
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white text-xs font-bold transition-all hover:scale-105 active:scale-95"
                            title="打印适于张贴的车间标准作业表"
                        >
                            <Printer size={14} />
                            <span>{t('打印规范')}</span>
                        </button>

                        {/* Admin Actions */}
                        {isAdmin && (
                            <button
                                onClick={() => handleEdit(selectedArticle)}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold transition-all hover:scale-105"
                            >
                                <Pencil size={14} />
                                <span>{t('编辑')}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Article Header Banner */}
                <div className="flex-shrink-0 px-8 py-6 bg-gradient-to-b from-indigo-950/30 to-transparent border-b border-gray-800/40">
                    <div className="max-w-5xl mx-auto">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                {CATEGORIES.find(c => c.id === selectedArticle.category)?.label || '综合规范'}
                            </span>
                            {selectedArticle.target_roles.map(r => (
                                <span
                                    key={r}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold"
                                    style={{ backgroundColor: (ROLE_COLORS[r] || '#666') + '22', color: ROLE_COLORS[r] || '#666', border: `1px solid ${(ROLE_COLORS[r] || '#666')}44` }}
                                >
                                    {r}
                                </span>
                            ))}
                            {selectedArticle.page_id && (
                                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-gray-800 text-gray-400 border border-gray-700">
                                    Page: {selectedArticle.page_id}
                                </span>
                            )}
                        </div>

                        <h1 className="text-3xl font-black text-white tracking-tight mb-2">
                            {selectedArticle.title}
                        </h1>
                        {selectedArticle.description && (
                            <p className="text-gray-400 text-sm leading-relaxed max-w-3xl">
                                {selectedArticle.description}
                            </p>
                        )}
                    </div>
                </div>

                {/* Article Main Body with TOC on the Right */}
                <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">
                    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                        {/* Left / Center: Article Content */}
                        <div className="lg:col-span-9 space-y-6">

                            {/* Embedded Video */}
                            {selectedArticle.video_url && renderVideoPlayer(selectedArticle.video_url)}

                            {/* Mode A: Interactive Checklist Mode */}
                            {isChecklistMode ? (
                                <div className="space-y-6">
                                    {/* Progress Card */}
                                    <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/50 to-blue-950/30 border border-indigo-500/30 shadow-xl">
                                        <div className="flex justify-between items-center mb-3">
                                            <div>
                                                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                                                    <CheckSquare size={18} className="text-indigo-400" />
                                                    {t('车间作业实操核对清单')}
                                                </h3>
                                                <p className="text-xs text-gray-400 mt-0.5">{t('在现场操作时，请逐项确认并打勾核验，确保安全无疏漏。')}</p>
                                            </div>
                                            <div className="text-right font-black text-2xl text-indigo-400">
                                                {progressPct}%
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="w-full h-2.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 rounded-full"
                                                style={{ width: `${progressPct}%` }}
                                            />
                                        </div>

                                        <div className="flex justify-between text-xs text-gray-500 mt-2 font-mono">
                                            <span>已完成: {checkedCount} 项</span>
                                            <span>总共: {checklistItems.length} 项</span>
                                        </div>
                                    </div>

                                    {/* Task Checklist Items */}
                                    <div className="space-y-3">
                                        {checklistItems.map((task, idx) => {
                                            const isDone = !!checkedTasks[`${selectedArticle.id}-${task}`];
                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => handleToggleTask(task)}
                                                    className={`group flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer select-none ${isDone
                                                        ? 'bg-indigo-950/20 border-indigo-500/40 text-gray-300'
                                                        : 'bg-gray-900/60 border-gray-800/80 text-white hover:border-gray-700 hover:bg-gray-900'
                                                        }`}
                                                >
                                                    <div className="mt-0.5 text-indigo-400 shrink-0">
                                                        {isDone ? (
                                                            <CheckSquare size={20} className="text-indigo-400 fill-indigo-500/20" />
                                                        ) : (
                                                            <Square size={20} className="text-gray-500 group-hover:text-gray-300" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 text-sm font-medium leading-relaxed">
                                                        <span className={`transition-all ${isDone ? 'line-through text-gray-500' : ''}`}>
                                                            {task}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="flex justify-end pt-4">
                                        <button
                                            onClick={() => {
                                                if (confirm(t('确定重置所有勾选状态吗？'))) {
                                                    setCheckedTasks({});
                                                    localStorage.removeItem(`sop_checklist_${selectedArticle.id}`);
                                                }
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-xs text-gray-400 hover:text-white"
                                        >
                                            <RotateCcw size={13} />
                                            {t('重置所有勾选')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Mode B: Standard Full Markdown Reader */
                                <div className="prose prose-invert max-w-none prose-indigo">
                                    <ReactMarkdown components={MarkdownComponents}>
                                        {selectedArticle.content}
                                    </ReactMarkdown>
                                </div>
                            )}

                            {/* Factory Floor Print Sign-off Box (Visible ONLY on print) */}
                            <div className="hidden print:block pt-12 mt-12 border-t-2 border-black text-black">
                                <div className="grid grid-cols-3 gap-8 text-xs font-bold">
                                    <div className="border-t border-black pt-2">
                                        <p>操作人 / 工号 (Operator):</p>
                                        <div className="h-10"></div>
                                        <p className="text-[10px] text-gray-500">签字确认 (Signature)</p>
                                    </div>
                                    <div className="border-t border-black pt-2">
                                        <p>班组长 / 主管 (Supervisor):</p>
                                        <div className="h-10"></div>
                                        <p className="text-[10px] text-gray-500">核验确认 (Approved)</p>
                                    </div>
                                    <div className="border-t border-black pt-2">
                                        <p>执行日期 (Date):</p>
                                        <div className="h-10"></div>
                                        <p className="text-[10px] text-gray-500">YYYY / MM / DD</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Table of Contents & Quick Summary (Hidden on Print & Small Screen) */}
                        <div className="hidden lg:block lg:col-span-3 sticky top-6 space-y-4 print:hidden">
                            {tableOfContents.length > 0 && (
                                <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800/80 backdrop-blur-md shadow-lg">
                                    <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider mb-3 flex items-center gap-1.5">
                                        <List size={14} className="text-indigo-400" />
                                        {t('章节大纲目录')}
                                    </h4>
                                    <nav className="space-y-1.5 text-xs max-h-[60vh] overflow-y-auto custom-scrollbar">
                                        {tableOfContents.map((h, i) => (
                                            <a
                                                key={i}
                                                href={`#${h.id}`}
                                                className={`block truncate transition-colors hover:text-white ${h.level === 1
                                                    ? 'font-bold text-gray-200'
                                                    : h.level === 2
                                                        ? 'pl-3 text-gray-400 hover:text-indigo-300'
                                                        : 'pl-6 text-gray-500 hover:text-indigo-300'
                                                    }`}
                                            >
                                                {h.text}
                                            </a>
                                        ))}
                                    </nav>
                                </div>
                            )}

                            {/* Quick Metadata Card */}
                            <div className="p-4 rounded-2xl bg-gray-900/40 border border-gray-800/60 text-xs space-y-2.5">
                                <div className="flex justify-between text-gray-400">
                                    <span>创建者:</span>
                                    <span className="font-bold text-gray-300">{selectedArticle.created_by || '系统'}</span>
                                </div>
                                <div className="flex justify-between text-gray-400">
                                    <span>更新时间:</span>
                                    <span className="font-bold text-gray-300">
                                        {selectedArticle.updated_at ? new Date(selectedArticle.updated_at).toLocaleDateString() : '-'}
                                    </span>
                                </div>
                                <div className="flex justify-between text-gray-400">
                                    <span>步骤项:</span>
                                    <span className="font-bold text-indigo-400">{checklistItems.length} 项标准操作</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. MAIN LIST VIEW WITH HERO, KPI & FILTERS
    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <div className="h-full flex flex-col overflow-hidden bg-gray-950 text-white">

            {/* Top Header Banner */}
            <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                            <BookOpen size={22} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-black tracking-tight text-white">{t('SOP Guide Center')}</h1>
                                <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-[10px] font-extrabold uppercase">
                                    Industrial 2.0
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('标准作业规程与岗位逻辑门户 • 汇聚车间、物流、人事全流程')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        {/* Executive AI Assistant Trigger */}
                        {isAdmin && (
                            <button
                                onClick={() => {
                                    setAiAction('generate');
                                    setAiResult(null);
                                    setShowAIModal(true);
                                }}
                                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95"
                            >
                                <Bot size={16} className="text-amber-300 animate-pulse" />
                                <span>{t('🤖 AI 智能起草 SOP')}</span>
                            </button>
                        )}

                        {/* Create Button */}
                        {isAdmin && (
                            <button
                                onClick={handleCreate}
                                className="px-3.5 py-2 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
                            >
                                <Plus size={15} />
                                <span>{t('新建 SOP')}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* KPI Metrics Ribbon */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="bg-gray-900/60 border border-gray-800/80 rounded-xl px-4 py-2.5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-gray-500">{t('规程总数')}</p>
                            <p className="text-lg font-black text-white">{stats.total}</p>
                        </div>
                        <BookOpen size={18} className="text-indigo-400 opacity-60" />
                    </div>
                    <div className="bg-gray-900/60 border border-gray-800/80 rounded-xl px-4 py-2.5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-gray-500">{t('已发布执行')}</p>
                            <p className="text-lg font-black text-emerald-400">{stats.published}</p>
                        </div>
                        <CheckCircle2 size={18} className="text-emerald-400 opacity-60" />
                    </div>
                    <div className="bg-gray-900/60 border border-gray-800/80 rounded-xl px-4 py-2.5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-gray-500">{t('我的工种适用')}</p>
                            <p className="text-lg font-black text-amber-400">{stats.forMyRole}</p>
                        </div>
                        <Users size={18} className="text-amber-400 opacity-60" />
                    </div>
                    <div className="bg-gray-900/60 border border-gray-800/80 rounded-xl px-4 py-2.5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-gray-500">{t('绑定系统页面')}</p>
                            <p className="text-lg font-black text-blue-400">{stats.withPages}</p>
                        </div>
                        <ExternalLink size={18} className="text-blue-400 opacity-60" />
                    </div>
                </div>

                {/* Category Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-2 mb-3">
                    {CATEGORIES.map(cat => {
                        const Icon = cat.icon;
                        const isSelected = selectedCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${isSelected
                                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20 scale-105'
                                    : 'bg-gray-900/70 text-gray-400 border-gray-800/80 hover:text-gray-200 hover:border-gray-700'
                                    }`}
                            >
                                <Icon size={14} className={isSelected ? 'text-white' : cat.color} />
                                <span>{t(cat.label)}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Search Bar, Role Filter & View Switcher */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 w-full">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder={t('搜索规范名称、核心步骤、设备机台或 Page ID...')}
                            className="w-full bg-gray-900/90 border border-gray-800 rounded-xl pl-10 pr-10 py-2 text-white text-xs placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Role Filter Tabs */}
                    <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 shrink-0">
                        <button
                            onClick={() => setRoleFilter('All')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${roleFilter === 'All' ? 'bg-gray-800 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            {t('全部角色')}
                        </button>
                        {ALL_ROLES.map(role => (
                            <button
                                key={role}
                                onClick={() => setRoleFilter(role)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${roleFilter === role ? 'bg-gray-800 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                                style={{ color: roleFilter === role ? ROLE_COLORS[role] : undefined }}
                            >
                                {role}
                            </button>
                        ))}
                    </div>

                    {/* View Switcher */}
                    <div className="flex items-center bg-gray-900 border border-gray-800 rounded-xl p-1 shrink-0">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg transition ${viewMode === 'grid' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-white'}`}
                            title="网格卡片视图"
                        >
                            <LayoutGrid size={15} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-lg transition ${viewMode === 'list' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-white'}`}
                            title="列表紧凑视图"
                        >
                            <List size={15} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Articles Display Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-500">
                        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
                        <span className="text-xs font-medium">{t('正在加载 SOP 规范库...')}</span>
                    </div>
                ) : filteredArticles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500 space-y-3">
                        <FileText size={48} className="opacity-20 text-indigo-400" />
                        <p className="font-bold text-sm text-gray-400">{t('未找到匹配的标准作业规程')}</p>
                        <p className="text-xs text-gray-600">{t('尝试切换分类筛选，或使用 AI 助手一键生成新规程')}</p>
                        {isAdmin && (
                            <button
                                onClick={() => {
                                    setAiAction('generate');
                                    setShowAIModal(true);
                                }}
                                className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
                            >
                                <Bot size={14} />
                                {t('立即由 AI 起草一份')}
                            </button>
                        )}
                    </div>
                ) : viewMode === 'grid' ? (
                    /* Grid Card View */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredArticles.map(article => {
                            const catObj = CATEGORIES.find(c => c.id === article.category);
                            const CatIcon = catObj?.icon || BookOpen;
                            const hasVideo = !!article.video_url;
                            const hasPage = !!article.page_id;

                            return (
                                <div
                                    key={article.id}
                                    onClick={() => setSelectedArticle(article)}
                                    className="group relative bg-gray-900/60 border border-gray-800/80 rounded-2xl overflow-hidden hover:border-indigo-500/40 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 cursor-pointer flex flex-col"
                                >
                                    {/* Card Header Media Gradient */}
                                    <div className="relative h-32 overflow-hidden bg-gradient-to-br from-indigo-950/80 via-gray-900 to-purple-950/40 p-4 flex flex-col justify-between">
                                        <div className="flex items-center justify-between z-10">
                                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/40 backdrop-blur-md border border-white/10 text-gray-300">
                                                <CatIcon size={12} className={catObj?.color} />
                                                {catObj?.label || '规范'}
                                            </span>

                                            {/* Status Badge */}
                                            {!article.is_published && (
                                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
                                                    {t('草稿')}
                                                </span>
                                            )}
                                        </div>

                                        {/* Center Watermark Icon */}
                                        <div className="absolute right-4 bottom-2 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-300">
                                            <CatIcon size={80} className="text-white" />
                                        </div>

                                        {/* Badges Ribbon (Video / Page Linked) */}
                                        <div className="flex items-center gap-1.5 z-10">
                                            {hasVideo && (
                                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] font-bold">
                                                    <Play size={10} /> 视频教学
                                                </span>
                                            )}
                                            {hasPage && (
                                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[9px] font-bold font-mono">
                                                    <ExternalLink size={10} /> {article.page_id}
                                                </span>
                                            )}
                                        </div>

                                        {/* Admin Quick Action Hover Bar */}
                                        {isAdmin && (
                                            <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleEdit(article); }}
                                                    className="p-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white hover:bg-blue-600 transition-colors"
                                                    title="编辑 SOP"
                                                >
                                                    <Pencil size={13} />
                                                </button>
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleDelete(article.id); }}
                                                    className="p-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white hover:bg-red-600 transition-colors"
                                                    title="删除 SOP"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Card Content Body */}
                                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                        <div>
                                            <h3 className="text-white font-extrabold text-sm mb-1.5 line-clamp-1 group-hover:text-indigo-300 transition-colors">
                                                {article.title}
                                            </h3>
                                            <p className="text-gray-400 text-xs line-clamp-2 leading-relaxed">
                                                {article.description || article.content.slice(0, 100)}
                                            </p>
                                        </div>

                                        {/* Target Roles & Footer */}
                                        <div className="pt-2 border-t border-gray-800/60 flex items-center justify-between">
                                            <div className="flex flex-wrap gap-1">
                                                {article.target_roles.length === 0 ? (
                                                    <span className="px-2 py-0.5 rounded-full bg-gray-800/80 text-gray-400 text-[10px] font-bold">
                                                        {t('全员适用')}
                                                    </span>
                                                ) : (
                                                    article.target_roles.slice(0, 3).map(r => (
                                                        <span
                                                            key={r}
                                                            className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                                            style={{ backgroundColor: (ROLE_COLORS[r] || '#666') + '20', color: ROLE_COLORS[r] || '#666' }}
                                                        >
                                                            {r}
                                                        </span>
                                                    ))
                                                )}
                                                {article.target_roles.length > 3 && (
                                                    <span className="px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-500 text-[9px] font-bold">
                                                        +{article.target_roles.length - 3}
                                                    </span>
                                                )}
                                            </div>

                                            <span className="text-[10px] text-gray-500 font-mono">
                                                {article.updated_at ? new Date(article.updated_at).toLocaleDateString() : ''}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* Dense List View */
                    <div className="bg-gray-900/40 border border-gray-800/80 rounded-2xl overflow-hidden divide-y divide-gray-800/60">
                        {filteredArticles.map(article => {
                            const catObj = CATEGORIES.find(c => c.id === article.category);
                            const CatIcon = catObj?.icon || BookOpen;

                            return (
                                <div
                                    key={article.id}
                                    onClick={() => setSelectedArticle(article)}
                                    className="p-4 flex items-center justify-between hover:bg-gray-900/80 transition-colors cursor-pointer group"
                                >
                                    <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-4">
                                        <div className="w-9 h-9 rounded-xl bg-gray-800/80 border border-gray-700/50 flex items-center justify-center shrink-0 text-indigo-400 group-hover:scale-105 transition-transform">
                                            <CatIcon size={16} className={catObj?.color} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 truncate transition-colors">
                                                    {article.title}
                                                </h4>
                                                {!article.is_published && (
                                                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                                                        草稿
                                                    </span>
                                                )}
                                                {article.page_id && (
                                                    <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 text-[10px] font-mono">
                                                        Page: {article.page_id}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 truncate">
                                                {article.description || article.content.slice(0, 80)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 shrink-0">
                                        <div className="flex gap-1">
                                            {article.target_roles.map(r => (
                                                <span
                                                    key={r}
                                                    className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                                    style={{ backgroundColor: (ROLE_COLORS[r] || '#666') + '20', color: ROLE_COLORS[r] || '#666' }}
                                                >
                                                    {r}
                                                </span>
                                            ))}
                                        </div>

                                        {isAdmin && (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleEdit(article); }}
                                                    className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleDelete(article.id); }}
                                                    className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-red-400 transition"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}

                                        <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-300 group-hover:translate-x-0.5 transition-all" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════════════
                3. EXECUTIVE AI CO-PILOT MODAL
            ═══════════════════════════════════════════════════════════════════════ */}
            {showAIModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-gray-950 border border-gray-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-gray-950">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                                    <Bot size={18} className="text-amber-300" />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-white">
                                        {t('高管专属 AI 智能副驾驶 (Executive AI SOP Co-pilot)')}
                                    </h2>
                                    <p className="text-[11px] text-gray-400">
                                        {t('输入要点，自动依据车间机台与工业工程规范起草或润色标准规程')}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setShowAIModal(false); setAiResult(null); }}
                                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">

                            {/* Step 1: Input & Configuration (when no result yet) */}
                            {!aiResult && (
                                <>
                                    {/* Topic / Prompt */}
                                    <div>
                                        <label className="text-xs font-bold text-gray-300 mb-1.5 flex items-center gap-1">
                                            <Sparkles size={13} className="text-indigo-400" />
                                            {t('SOP 主题或要点描述')}
                                        </label>
                                        <textarea
                                            value={aiTopic}
                                            onChange={e => setAiTopic(e.target.value)}
                                            placeholder={t('例如：帮我起草关于拉伸膜机 T1.1-M03 换卷与厚度校准的规程，或者气泡膜机开机排气防爆孔注意事项...')}
                                            rows={3}
                                            className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white text-xs placeholder-gray-500 focus:border-indigo-500 outline-none resize-none"
                                        />
                                    </div>

                                    {/* Language Mode Selector */}
                                    <div>
                                        <label className="text-xs font-bold text-gray-300 mb-1.5 flex items-center gap-1">
                                            <Languages size={13} className="text-indigo-400" />
                                            {t('语言与双语对照模式')}
                                        </label>
                                        <div className="grid grid-cols-3 gap-2.5">
                                            {[
                                                { id: 'zh', label: '纯中文规程', sub: '专业严谨工业规范' },
                                                { id: 'zh-bm', label: '中+马双语对照', sub: '适合车间与司机一线 (推荐)' },
                                                { id: 'zh-en', label: '中+英双语对照', sub: '跨国协作与管理标准' },
                                            ].map(lang => (
                                                <button
                                                    key={lang.id}
                                                    onClick={() => setAiLanguage(lang.id as any)}
                                                    className={`p-3 rounded-xl border text-left transition-all ${aiLanguage === lang.id
                                                        ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-md'
                                                        : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
                                                        }`}
                                                >
                                                    <p className="font-bold text-xs">{lang.label}</p>
                                                    <p className="text-[10px] text-gray-500 mt-0.5">{lang.sub}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* SOP Type Selector */}
                                    <div>
                                        <label className="text-xs font-bold text-gray-300 mb-1.5 block">
                                            {t('规程类型与重点')}
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {[
                                                { id: 'standard', label: '⚙️ 标准操作规程', sub: '开机生产全流程' },
                                                { id: 'troubleshooting', label: '🔧 设备排障指南', sub: '异常现象与排除' },
                                                { id: 'safety', label: '🛡️ 安全防护守则', sub: '高危作业与PPE' },
                                                { id: 'delivery', label: '🚚 司机交接标准', sub: '拍照交单还车' },
                                            ].map(type => (
                                                <button
                                                    key={type.id}
                                                    onClick={() => setAiSopType(type.id)}
                                                    className={`p-2.5 rounded-xl border text-left transition-all ${aiSopType === type.id
                                                        ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                                                        : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700'
                                                        }`}
                                                >
                                                    <p className="font-bold text-xs">{type.label}</p>
                                                    <p className="text-[9px] text-gray-400 mt-0.5">{type.sub}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Action Trigger Button */}
                                    <div className="pt-2">
                                        <button
                                            onClick={() => handleRunAIAssistant('generate')}
                                            disabled={aiLoading || !aiTopic.trim()}
                                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {aiLoading ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    <span>{t('AI 正在调取机台数据与规程库撰写中...')}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles size={16} />
                                                    <span>{t('开始由 AI 生成标准规程')}</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* Step 2: AI Result Preview & Confirmation */}
                            {aiResult && (
                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-indigo-400">{t('AI 草稿生成就绪')}</span>
                                            <h3 className="font-black text-white text-base mt-0.5">{aiResult.title}</h3>
                                            <p className="text-xs text-gray-400 mt-0.5">{aiResult.description}</p>
                                        </div>
                                        <div className="flex gap-1.5 shrink-0">
                                            {aiResult.suggested_roles?.map((r: string) => (
                                                <span key={r} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300">
                                                    {r}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Markdown Preview Box */}
                                    <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 max-h-96 overflow-y-auto custom-scrollbar prose prose-invert prose-indigo text-xs">
                                        <ReactMarkdown components={MarkdownComponents}>
                                            {aiResult.content}
                                        </ReactMarkdown>
                                    </div>

                                    {/* Apply Actions */}
                                    <div className="flex items-center justify-between pt-2">
                                        <button
                                            onClick={() => setAiResult(null)}
                                            className="px-4 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 hover:text-white text-xs font-bold flex items-center gap-1.5"
                                        >
                                            <RotateCcw size={13} />
                                            {t('重新调整提示词')}
                                        </button>

                                        <div className="flex gap-2">
                                            {isEditing && (
                                                <button
                                                    onClick={() => handleApplyAIResult('append')}
                                                    className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold"
                                                >
                                                    {t('追加到末尾')}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleApplyAIResult('replace')}
                                                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
                                            >
                                                <Check size={14} />
                                                {t('采纳并填入编辑器')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════════
                4. MODERN FULL-FEATURED SOP EDITOR MODAL
            ═══════════════════════════════════════════════════════════════════════ */}
            {isEditing && editArticle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
                    <div className="bg-gray-950 border border-gray-800 rounded-3xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">

                        {/* Editor Header */}
                        <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-800 bg-gray-950 shrink-0">
                            <div className="flex items-center gap-3">
                                <span className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
                                    <Pencil size={16} />
                                </span>
                                <div>
                                    <h2 className="text-base font-black text-white">
                                        {editArticle.id ? t('编辑标准作业规程') : t('新建标准作业规程')}
                                    </h2>
                                    <p className="text-[10px] text-gray-500">{t('支持 Markdown 渲染、AI 润色与车间实操大纲')}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Editor View Modes */}
                                <div className="flex items-center bg-gray-900 border border-gray-800 rounded-xl p-1">
                                    <button
                                        onClick={() => setEditorTab('write')}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${editorTab === 'write' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        {t('纯编辑')}
                                    </button>
                                    <button
                                        onClick={() => setEditorTab('split')}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${editorTab === 'split' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        {t('分屏预览')}
                                    </button>
                                    <button
                                        onClick={() => setEditorTab('preview')}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${editorTab === 'preview' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        {t('最终预览')}
                                    </button>
                                </div>

                                <button
                                    onClick={() => { setIsEditing(false); setEditArticle(null); }}
                                    className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Editor AI & Template Quick Toolbar */}
                        <div className="px-6 py-2 border-b border-gray-800/80 bg-gray-900/40 flex flex-wrap items-center justify-between gap-2 shrink-0">
                            {/* In-Editor AI Actions */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-indigo-400 flex items-center gap-1 mr-1">
                                    <Bot size={13} />
                                    AI 工具箱:
                                </span>
                                <button
                                    onClick={() => {
                                        setAiTopic(editArticle.title || '当前草稿润色');
                                        setAiAction('polish');
                                        handleRunAIAssistant('polish');
                                        setShowAIModal(true);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-[11px] font-bold transition"
                                >
                                    🪄 工业级润色
                                </button>
                                <button
                                    onClick={() => {
                                        setAiTopic(editArticle.title || '安全警示补充');
                                        setAiAction('safety_alerts');
                                        handleRunAIAssistant('safety_alerts');
                                        setShowAIModal(true);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-amber-300 text-[11px] font-bold transition"
                                >
                                    ⚠️ 补充安全警示
                                </button>
                                <button
                                    onClick={() => {
                                        setAiLanguage('zh-bm');
                                        setAiAction('translate');
                                        handleRunAIAssistant('translate');
                                        setShowAIModal(true);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-emerald-300 text-[11px] font-bold transition"
                                >
                                    🌐 转中马双语
                                </button>
                            </div>

                            {/* Template Preset Dropdown */}
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-gray-500">{t('套用标准模板')}:</span>
                                <select
                                    onChange={e => {
                                        const idx = Number(e.target.value);
                                        if (!isNaN(idx) && SOP_TEMPLATES[idx]) {
                                            if (editArticle.content && !confirm(t('套用模板将覆盖当前内容，是否继续？'))) return;
                                            setEditArticle(prev => prev ? { ...prev, content: SOP_TEMPLATES[idx].template } : prev);
                                        }
                                    }}
                                    defaultValue=""
                                    className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-2.5 py-1 outline-none"
                                >
                                    <option value="" disabled>{t('选择预置模板...')}</option>
                                    {SOP_TEMPLATES.map((tmpl, idx) => (
                                        <option key={idx} value={idx}>{tmpl.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Editor Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">

                            {/* Row 1: Title & Category */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <label className="text-[11px] font-black uppercase text-gray-400 mb-1 block">
                                        {t('规程标题 (Title) *')}
                                    </label>
                                    <input
                                        value={editArticle.title || ''}
                                        onChange={e => setEditArticle(prev => prev ? { ...prev, title: e.target.value } : prev)}
                                        placeholder={t('例如：拉伸膜机 T1.1-M03 换卷与厚度校准规程')}
                                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-indigo-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-black uppercase text-gray-400 mb-1 block">
                                        {t('所属分类 (Category)')}
                                    </label>
                                    <select
                                        value={editArticle.category || 'production'}
                                        onChange={e => setEditArticle(prev => prev ? { ...prev, category: e.target.value } : prev)}
                                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-white text-xs focus:border-indigo-500 outline-none"
                                    >
                                        {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                                            <option key={c.id} value={c.id}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Row 2: Description */}
                            <div>
                                <label className="text-[11px] font-black uppercase text-gray-400 mb-1 block">
                                    {t('简要说明 (Description)')}
                                </label>
                                <input
                                    value={editArticle.description || ''}
                                    onChange={e => setEditArticle(prev => prev ? { ...prev, description: e.target.value } : prev)}
                                    placeholder={t('用一句话概括此规程的目的与适用范围')}
                                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-white text-xs focus:border-indigo-500 outline-none"
                                />
                            </div>

                            {/* Row 3: Target Roles & Page Link */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Roles */}
                                <div>
                                    <label className="text-[11px] font-black uppercase text-gray-400 mb-1.5 block">
                                        {t('适用工种角色 (Target Roles)')}
                                    </label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {ALL_ROLES.map(role => {
                                            const isSelected = editArticle.target_roles?.includes(role);
                                            return (
                                                <button
                                                    key={role}
                                                    type="button"
                                                    onClick={() => {
                                                        setEditArticle(prev => {
                                                            if (!prev) return prev;
                                                            const cur = prev.target_roles || [];
                                                            return {
                                                                ...prev,
                                                                target_roles: isSelected
                                                                    ? cur.filter(r => r !== role)
                                                                    : [...cur, role]
                                                            };
                                                        });
                                                    }}
                                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition border ${isSelected
                                                        ? 'border-white/40 scale-105 shadow-sm'
                                                        : 'border-gray-800 opacity-60 hover:opacity-100'
                                                        }`}
                                                    style={{
                                                        backgroundColor: isSelected ? (ROLE_COLORS[role] || '#666') + '25' : 'transparent',
                                                        color: ROLE_COLORS[role] || '#666'
                                                    }}
                                                >
                                                    {role}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Associated System Page Dropdown */}
                                <div>
                                    <label className="text-[11px] font-black uppercase text-gray-400 mb-1.5 block">
                                        {t('关联系统功能模块 (Deep Link Page)')}
                                    </label>
                                    <select
                                        value={editArticle.page_id || ''}
                                        onChange={e => setEditArticle(prev => prev ? { ...prev, page_id: e.target.value } : prev)}
                                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-white text-xs focus:border-indigo-500 outline-none"
                                    >
                                        <option value="">{t('无关联功能 (纯指导文档)')}</option>
                                        {SYSTEM_PAGES.map(p => (
                                            <option key={p.id} value={p.id}>
                                                [{p.id}] {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Row 4: Video URL & Publish Status */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-black uppercase text-gray-400 mb-1 block">
                                        {t('教学视频链接 (YouTube 或 MP4 URL)')}
                                    </label>
                                    <input
                                        value={editArticle.video_url || ''}
                                        onChange={e => setEditArticle(prev => prev ? { ...prev, video_url: e.target.value } : prev)}
                                        placeholder="https://www.youtube.com/watch?v=... 或 .mp4"
                                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-white text-xs focus:border-indigo-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-black uppercase text-gray-400 mb-1 block">
                                        {t('发布状态 (Publication Status)')}
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setEditArticle(prev => prev ? { ...prev, is_published: !prev.is_published } : prev)}
                                        className={`w-full py-2.5 rounded-xl font-bold text-xs transition border flex items-center justify-center gap-2 ${editArticle.is_published
                                            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400'
                                            : 'bg-gray-900 border-gray-800 text-gray-500'
                                            }`}
                                    >
                                        {editArticle.is_published ? (
                                            <>
                                                <CheckCircle2 size={15} />
                                                <span>{t('✅ 已发布 (对指定角色可见)')}</span>
                                            </>
                                        ) : (
                                            <>
                                                <AlertCircle size={15} />
                                                <span>{t('🔒 草稿 (仅管理员可见)')}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Row 5: Content Markdown Editor with Live Split / Preview */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-black uppercase text-gray-400">
                                        {t('规程正文内容 (Markdown Format) *')}
                                    </label>
                                    <span className="text-[10px] text-gray-500 font-mono">
                                        支持标准 Markdown 表格与 &gt; [!WARNING] 警示块
                                    </span>
                                </div>

                                <div className={`grid gap-4 ${editorTab === 'split' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                                    {/* Textarea (Visible in 'write' or 'split') */}
                                    {editorTab !== 'preview' && (
                                        <textarea
                                            value={editArticle.content || ''}
                                            onChange={e => setEditArticle(prev => prev ? { ...prev, content: e.target.value } : prev)}
                                            placeholder={t('# 标题\n\n> [!NOTE]\n> 背景或目的说明\n\n## 1. 步骤清单\n- [ ] 1. 第一步\n- [ ] 2. 第二步\n\n> [!WARNING]\n> 安全与注意事项')}
                                            rows={14}
                                            className="w-full bg-gray-900/90 border border-gray-800 rounded-xl p-4 text-white font-mono text-xs focus:border-indigo-500 outline-none resize-y leading-relaxed"
                                        />
                                    )}

                                    {/* Live Preview (Visible in 'preview' or 'split') */}
                                    {editorTab !== 'write' && (
                                        <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 max-h-[380px] overflow-y-auto custom-scrollbar prose prose-invert prose-indigo text-xs">
                                            {editArticle.content ? (
                                                <ReactMarkdown components={MarkdownComponents}>
                                                    {editArticle.content}
                                                </ReactMarkdown>
                                            ) : (
                                                <p className="text-gray-500 italic">{t('在左侧输入 Markdown，此处将实时渲染最终效果...')}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>

                        {/* Editor Footer */}
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800 bg-gray-950 shrink-0">
                            <button
                                onClick={() => { setIsEditing(false); setEditArticle(null); }}
                                className="px-5 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 hover:text-white font-bold text-xs transition"
                            >
                                {t('取消')}
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 hover:scale-105 active:scale-95 transition-all"
                            >
                                <Save size={15} />
                                {t('保存规程')}
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}
