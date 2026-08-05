import { useState, useEffect } from 'react';
import { Lightbulb, X, BookOpen, Edit, FileText, Sparkles, HelpCircle, ArrowRight } from 'lucide-react';
import { supabase } from '../services/supabase';

interface PageLogicDrawerProps {
    activePage: string;
    userRole?: string;
    user?: any;
    setActivePage: (page: string) => void;
}

interface SOPArticle {
    id: string;
    title: string;
    description: string;
    content: string;
    page_id: string;
    target_roles: string[];
    is_published: boolean;
    updated_at: string;
}

const ROLE_COLORS: Record<string, string> = {
    SuperAdmin: '#ef4444',
    Admin: '#3b82f6',
    Manager: '#8b5cf6',
    Operator: '#f59e0b',
    Driver: '#10b981',
    HR: '#ec4899',
};

export default function PageLogicDrawer({ activePage, userRole, user, setActivePage }: PageLogicDrawerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [articles, setArticles] = useState<SOPArticle[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'logic' | 'flow'>('logic');

    const isAdmin = userRole === 'SuperAdmin' || userRole === 'Admin' || user?.employeeId === '001';

    // Don't show on login/register/password update pages
    const isAuthPage = ['login', 'register', 'update-password'].includes(activePage);

    // 监听左侧菜单触发打开 本页逻辑 弹窗
    useEffect(() => {
        const handleOpen = () => setIsOpen(true);
        window.addEventListener('packsecure:open-page-logic', handleOpen);
        return () => window.removeEventListener('packsecure:open-page-logic', handleOpen);
    }, []);

    useEffect(() => {
        if (!isOpen || !activePage || isAuthPage) return;

        const fetchPageLogic = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('sop_articles')
                    .select('id, title, description, content, page_id, target_roles, is_published, updated_at')
                    .eq('page_id', activePage)
                    .eq('is_published', true);

                if (!error && data) {
                    // Filter articles based on target roles
                    const filtered = data.filter(a => {
                        if (isAdmin) return true; // Admins can see all rules
                        if (!a.target_roles || a.target_roles.length === 0) return true; // Open to all
                        return userRole && a.target_roles.includes(userRole);
                    });
                    setArticles(filtered);
                } else {
                    setArticles([]);
                }
            } catch (err) {
                console.error('Failed to load page logic:', err);
                setArticles([]);
            } finally {
                setLoading(false);
            }
        };

        fetchPageLogic();
    }, [isOpen, activePage, userRole, user, isAdmin, isAuthPage]);

    if (isAuthPage) return null;

    const handleGoToEdit = () => {
        localStorage.setItem('sop_center_search_term', activePage);
        setActivePage('sop-center');
        setIsOpen(false);
    };

    // Render simple markdown formatting
    const renderMarkdown = (text: string) => {
        if (!text) return <p className="text-gray-400 italic">暂无详细说明</p>;
        
        return text.split('\n').map((line, i) => {
            if (line.startsWith('### ')) {
                return <h3 key={i} className="text-sm font-bold text-white mt-4 mb-2 flex items-center gap-1.5 border-b border-gray-800 pb-1">{line.slice(4)}</h3>;
            }
            if (line.startsWith('## ')) {
                return <h2 key={i} className="text-base font-extrabold text-indigo-400 mt-5 mb-2.5">{line.slice(3)}</h2>;
            }
            if (line.startsWith('# ')) {
                return <h1 key={i} className="text-lg font-black text-white mt-6 mb-3 border-b-2 border-indigo-500/20 pb-1.5">{line.slice(2)}</h1>;
            }
            if (line.startsWith('- ')) {
                return <li key={i} className="text-gray-300 ml-4 list-disc mb-1 text-xs leading-relaxed">{line.slice(2)}</li>;
            }
            if (line.startsWith('> ')) {
                return (
                    <blockquote key={i} className="border-l-4 border-indigo-500 bg-indigo-950/20 px-3 py-2 text-gray-300 text-xs italic my-3 rounded-r-lg">
                        {line.slice(2)}
                    </blockquote>
                );
            }
            if (line.trim() === '') {
                return <div key={i} className="h-2" />;
            }
            
            // Check for inline highlight backticks
            const parts = line.split(/(`[^`]+`)/g);
            if (parts.length > 1) {
                return (
                    <p key={i} className="text-gray-300 text-xs leading-relaxed mb-2">
                        {parts.map((part, index) => {
                            if (part.startsWith('`') && part.endsWith('`')) {
                                return (
                                    <code key={index} className="px-1.5 py-0.5 rounded bg-gray-900 border border-gray-800 text-indigo-300 font-mono text-[11px] mx-0.5">
                                        {part.slice(1, -1)}
                                    </code>
                                );
                            }
                            return part;
                        })}
                    </p>
                );
            }

            return <p key={i} className="text-gray-300 text-xs leading-relaxed mb-2">{line}</p>;
        });
    };

    return (
        <>

            {/* Slider Drawer Overlay */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-all duration-300 flex justify-end"
                    onClick={() => setIsOpen(false)}
                >
                    {/* Drawer container */}
                    <div 
                        className="w-full max-w-md bg-gray-950/95 border-l border-gray-800/80 shadow-2xl h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 pointer-events-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Drawer Header */}
                        <div className="px-6 py-5 border-b border-gray-800/60 bg-gray-900/40 backdrop-blur-md flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                    <Sparkles size={18} />
                                </div>
                                <div>
                                    <h2 className="text-sm font-black text-white tracking-wider uppercase">页面逻辑与规范</h2>
                                    <p className="text-[10px] text-gray-500 font-mono">Page ID: {activePage}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-gray-800/80 text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex border-b border-gray-900 bg-gray-950 shrink-0">
                            <button 
                                onClick={() => setActiveTab('logic')}
                                className={`flex-1 py-3 text-center text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                                    activeTab === 'logic' 
                                        ? 'border-indigo-500 text-indigo-400 bg-indigo-950/10' 
                                        : 'border-transparent text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                <FileText size={14} />
                                业务逻辑与规则
                            </button>
                            <button 
                                onClick={() => setActiveTab('flow')}
                                className={`flex-1 py-3 text-center text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                                    activeTab === 'flow' 
                                        ? 'border-indigo-500 text-indigo-400 bg-indigo-950/10' 
                                        : 'border-transparent text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                <BookOpen size={14} />
                                标准操作指南 (SOP)
                            </button>
                        </div>

                        {/* Drawer Body (Scrollable) */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-500">
                                    <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
                                    <span className="text-xs">正在调取系统规则...</span>
                                </div>
                            ) : articles.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
                                    <HelpCircle size={44} className="text-gray-700 opacity-60" />
                                    <div>
                                        <p className="text-sm font-bold text-gray-400">此页面未关联业务逻辑说明</p>
                                        <p className="text-xs text-gray-600 mt-1 max-w-[280px]">
                                            数据表中暂无绑定当前 Page ID (`{activePage}`) 且已发布的逻辑文档。
                                        </p>
                                    </div>
                                    {isAdmin && (
                                        <button 
                                            onClick={handleGoToEdit}
                                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                                        >
                                            <Edit size={12} />
                                            前往 SOP 中心创建
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {articles.map((article) => (
                                        <div key={article.id} className="bg-gray-900/30 border border-gray-800/40 rounded-xl p-4 space-y-3">
                                            <div>
                                                <div className="flex items-start justify-between gap-2">
                                                    <h3 className="text-sm font-extrabold text-white">{article.title}</h3>
                                                    {isAdmin && (
                                                        <button 
                                                            onClick={handleGoToEdit}
                                                            className="text-gray-500 hover:text-indigo-400 p-1 rounded hover:bg-gray-800 transition-colors"
                                                            title="去编辑此逻辑"
                                                        >
                                                            <Edit size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-gray-500 mt-1">{article.description}</p>
                                            </div>

                                            {/* Article Content Area */}
                                            {activeTab === 'logic' ? (
                                                <div className="pt-2 border-t border-gray-800/60 font-sans">
                                                    {renderMarkdown(article.content)}
                                                </div>
                                            ) : (
                                                <div className="pt-2 border-t border-gray-800/60 space-y-3">
                                                    <div className="flex items-center gap-2 text-xs text-indigo-400 font-bold bg-indigo-500/5 p-2.5 rounded-lg border border-indigo-500/10">
                                                        <BookOpen size={14} />
                                                        <span>此页标准操作规范 (SOP) 已生效</span>
                                                    </div>
                                                    <p className="text-xs text-gray-400 leading-relaxed">
                                                        你可以前往 **SOP 指南中心** 查看完整规范、操作步骤视频演示及打印文档。
                                                    </p>
                                                    <button 
                                                        onClick={() => {
                                                            setActivePage('sop-center');
                                                            setIsOpen(false);
                                                        }}
                                                        className="w-full py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                                                    >
                                                        进入 SOP 中心
                                                        <ArrowRight size={12} />
                                                    </button>
                                                </div>
                                            )}

                                            {/* Last Updated */}
                                            <div className="pt-2 border-t border-gray-900 flex justify-between items-center text-[9px] text-gray-600">
                                                <span>更新时间: {new Date(article.updated_at).toLocaleDateString()}</span>
                                                {article.target_roles && article.target_roles.length > 0 && (
                                                    <div className="flex gap-1">
                                                        {article.target_roles.map(r => (
                                                            <span 
                                                                key={r} 
                                                                className="px-1.5 py-0.5 rounded text-[8px] font-bold"
                                                                style={{ backgroundColor: (ROLE_COLORS[r] || '#666') + '15', color: ROLE_COLORS[r] || '#666' }}
                                                            >
                                                                {r}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Drawer Footer */}
                        {articles.length > 0 && (
                            <div className="px-6 py-4 border-t border-gray-800/60 bg-gray-900/40 shrink-0 text-center">
                                <p className="text-[10px] text-gray-500 flex items-center justify-center gap-1">
                                    <Sparkles size={10} className="text-indigo-400" />
                                    业务规则由管理员动态维护，以线上逻辑为准
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
