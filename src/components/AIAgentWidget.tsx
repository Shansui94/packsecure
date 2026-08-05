import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, MessageSquare, Mic, MicOff, Sparkles } from 'lucide-react';

interface Message {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    timestamp: Date;
    action?: { type: string; target: string } | null;
}

interface User {
    uid: string;
    email: string | null;
    role: string;
    name?: string;
    employeeId?: string;
}

interface AIAgentWidgetProps {
    user: User | null;
    onNavigate?: (page: string) => void;
}

// Define specific themes, welcome messages, and quick actions per role
const ROLE_THEMES: Record<string, { headerBg: string; accentColor: string; welcome: string; actions: string[] }> = {
    SuperAdmin: {
        headerBg: 'bg-gradient-to-r from-zinc-800 to-amber-700',
        accentColor: 'bg-amber-600 hover:bg-amber-700',
        welcome: '你好，系统管理员！我是系统与数据专家。我可以协助你查询表结构（Schema）、检查 RLS 策略、诊断重复数据或编写 SQL 迁移脚本。',
        actions: ['🔍 查主表 Schema', '🛡️ 检查 RLS 策略', '🧹 诊断数据重复']
    },
    Admin: {
        headerBg: 'bg-gradient-to-r from-yellow-600 to-amber-700',
        accentColor: 'bg-amber-600 hover:bg-amber-700',
        welcome: '你好，管理员！我是你的系统与运行助手。请问需要我帮你检查系统性能、用户状态或数据库排错吗？',
        actions: ['🔍 查主表 Schema', '🛡️ 检查 RLS 策略', '🧹 诊断数据重复']
    },
    Manager: {
        headerBg: 'bg-gradient-to-r from-blue-700 to-indigo-700',
        accentColor: 'bg-blue-600 hover:bg-blue-700',
        welcome: '你好，经理！我是 Titan，生产部门的主管。请问你想了解今日产量、机器效率、宕机报警还是待审核的请假与报销？',
        actions: ['📊 今日产量简报', '🚨 异常宕机分析', '🧾 待审批报销']
    },
    Operator: {
        headerBg: 'bg-gradient-to-r from-blue-600 to-cyan-600',
        accentColor: 'bg-blue-600 hover:bg-blue-700',
        welcome: '你好！我是你的生产现场协作者。你可以向我咨询当前的生产任务、各机器的标准周期时间，或者让我帮你查询特定设备的 SOP 操作规程。',
        actions: ['⚙️ 活跃生产任务', '📖 机器操作SOP', '📈 机器今日产量']
    },
    Driver: {
        headerBg: 'bg-gradient-to-r from-emerald-600 to-teal-600',
        accentColor: 'bg-emerald-600 hover:bg-emerald-700',
        welcome: '你好，司机师傅！我是你的配送与费用助理。你可以向我查询你今天的配送订单、本月工资预支额度，或者询问费用报销的规则。',
        actions: ['📅 今日配送行程', '💰 预支工资额度', '🛣️ 报销规则']
    },
    HR: {
        headerBg: 'bg-gradient-to-r from-violet-600 to-fuchsia-600',
        accentColor: 'bg-violet-600 hover:bg-violet-700',
        welcome: '你好，人事主管！我是你的人事助手。我可以帮你查询待审批的请假申请、节假日安排或员工出勤汇总。',
        actions: ['📝 待审核假期', '📅 假节日日历', '💸 待审批工资']
    },
    Finance: {
        headerBg: 'bg-gradient-to-r from-purple-700 to-indigo-700',
        accentColor: 'bg-purple-600 hover:bg-purple-700',
        welcome: '你好，财务！我是你的费用审计助手。我可以帮你汇总待处理的报销单、查询已批复的总额或核对工资账单。',
        actions: ['🧾 待审批报销', '💵 本月已批报销', '💸 待审批工资']
    },
    Sales: {
        headerBg: 'bg-gradient-to-r from-orange-500 to-rose-600',
        accentColor: 'bg-orange-600 hover:bg-orange-700',
        welcome: '你好，销售主管！我可以帮你查询订单状态、配送进度或客户的送货区域。',
        actions: ['📦 销售订单状态', '🚚 查询出货单']
    }
};

export default function AIAgentWidget({ user, onNavigate }: AIAgentWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);

    // Resolve active theme based on user role
    const userRole = user?.role || 'Operator';
    const activeTheme = ROLE_THEMES[userRole] || {
        headerBg: 'bg-gradient-to-r from-blue-600 to-indigo-600',
        accentColor: 'bg-blue-600 hover:bg-blue-700',
        welcome: '你好！我是你的 AI 生产主管助理。有什么我可以帮你的吗？',
        actions: []
    };

    // Reset messages and welcome prompt when user session loads or shifts
    useEffect(() => {
        const welcomeText = `你好 ${user?.name || '同事'}！${activeTheme.welcome}`;
        setMessages([
            {
                id: 'welcome',
                sender: 'ai',
                text: welcomeText,
                timestamp: new Date(),
                action: null
            }
        ]);
    }, [user, userRole]);

    // Scroll chat body to bottom when messages update
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    // 监听左侧菜单触发打开 AI 助理弹窗
    useEffect(() => {
        const handleOpen = () => setIsOpen(true);
        window.addEventListener('packsecure:open-ai-chat', handleOpen);
        return () => window.removeEventListener('packsecure:open-ai-chat', handleOpen);
    }, []);

    // Initialize HTML5 Web Speech recognition
    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'zh-CN'; // Default language

            recognition.onstart = () => {
                setIsListening(true);
            };

            recognition.onresult = (event: any) => {
                const speechToText = event.results[0][0].transcript;
                if (speechToText) {
                    setQuery(prev => prev + speechToText);
                }
            };

            recognition.onerror = (event: any) => {
                console.error('Speech Recognition Error:', event);
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        }
    }, []);

    // Helper to start/stop listening
    const handleVoiceToggle = () => {
        if (!recognitionRef.current) {
            alert('当前浏览器不支持语音识别功能，请尝试使用 Chrome, Edge 或 Safari。');
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
    };

    // Parse navigation actions embedded in the text
    const parseActionFromText = (text: string) => {
        const actionRegex = /\[ACTION:(\w+):([\w-]+)\]/;
        const match = text.match(actionRegex);
        if (match) {
            const [fullMatch, actionType, target] = match;
            const cleanedText = text.replace(fullMatch, '').trim();
            return {
                text: cleanedText,
                action: { type: actionType, target }
            };
        }
        return { text, action: null };
    };

    // Submit user query to backend API
    const handleSend = async (customQuery?: string) => {
        const messageText = customQuery || query;
        if (!messageText.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            sender: 'user',
            text: messageText,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        if (!customQuery) {
            setQuery('');
        }
        setIsLoading(true);

        try {
            const response = await fetch('/api/agent/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: userMsg.text,
                    userContext: user ? {
                        role: user.role,
                        name: user.name,
                        email: user.email,
                        uid: user.uid,
                        employeeId: user.employeeId
                    } : null
                })
            });

            if (!response.ok) throw new Error('连接 AI 助手失败');

            const data = await response.json();
            const rawResponseText = data.response || "我没能理解您的请求。";
            
            // Extract any routing actions inside response text
            const { text: cleanText, action } = parseActionFromText(rawResponseText);

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: cleanText,
                timestamp: new Date(),
                action
            };

            setMessages(prev => [...prev, aiMsg]);

        } catch (err) {
            console.error(err);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: "⚠️ 抱歉，连接大脑时遇到错误，请检查网络或服务端日志。",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
            {/* Chat Window */}
            {isOpen && (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-2xl rounded-2xl w-80 md:w-96 mb-4 overflow-hidden pointer-events-auto flex flex-col transition-all animate-in slide-in-from-bottom-10 fade-in duration-300" style={{ height: '520px' }}>

                    {/* Header */}
                    <div className={`${activeTheme.headerBg} p-4 flex justify-between items-center text-white shrink-0`}>
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-white/20 rounded-full">
                                <Bot size={20} className="text-white animate-pulse" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm flex items-center gap-1.5">
                                    {userRole === 'SuperAdmin' || userRole === 'Admin' ? '数据专家 JARVIS' : '智能主管 Titan'}
                                </h3>
                                <p className="text-xs text-blue-100 flex items-center gap-1">
                                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                    {userRole} • 在线
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors text-white">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-950/50">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex w-full flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${msg.sender === 'user'
                                        ? `${activeTheme.accentColor} text-white rounded-br-none`
                                        : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-bl-none prose prose-sm dark:prose-invert'
                                        }`}
                                    style={{ whiteSpace: 'pre-wrap' }}
                                >
                                    {msg.text}

                                    {/* Action button rendering */}
                                    {msg.action && msg.action.type === 'navigate' && onNavigate && (
                                        <button
                                            onClick={() => {
                                                onNavigate!(msg.action!.target);
                                                setIsOpen(false);
                                            }}
                                            className="mt-3 w-full bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 py-2 px-4 rounded-xl border border-indigo-200 dark:border-indigo-850 text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                                        >
                                            <Sparkles size={14} className="animate-pulse" />
                                            一键前往 {msg.action.target.toUpperCase()} 页面
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start w-full">
                                <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-1">
                                    <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"></div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Action Buttons */}
                    {activeTheme.actions && activeTheme.actions.length > 0 && (
                        <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex gap-2 overflow-x-auto shrink-0 scrollbar-none">
                            {activeTheme.actions.map((act, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleSend(act)}
                                    disabled={isLoading}
                                    className="px-3 py-1 bg-white hover:bg-zinc-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-full text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-colors whitespace-nowrap active:scale-95 shadow-sm"
                                >
                                    {act}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input Area */}
                    <div className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
                        <div className="relative flex items-center gap-2">
                            {/* Speech Recognition Mic Icon */}
                            <button
                                onClick={handleVoiceToggle}
                                className={`p-2 rounded-full transition-all shrink-0 border ${
                                    isListening
                                        ? 'bg-red-500 text-white border-red-400 animate-pulse scale-105'
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-transparent hover:bg-zinc-200'
                                }`}
                                type="button"
                                title="语音录入"
                            >
                                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                            </button>

                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder={isListening ? '正在录音...' : '发消息提问...'}
                                    className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-full py-2.5 pl-4 pr-12 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-400 text-zinc-800 dark:text-zinc-200"
                                    disabled={isLoading}
                                />
                                <button
                                    onClick={() => handleSend()}
                                    disabled={!query.trim() || isLoading}
                                    className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-white rounded-full disabled:opacity-50 disabled:hover:scale-100 transition-all shadow-sm ${activeTheme.accentColor}`}
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            )}

            {/* Floating Toggle Button (Hidden on mobile to avoid blocking view) */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="hidden lg:flex group pointer-events-auto items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 hover:shadow-blue-500/30"
                >
                    <div className="absolute inset-0 rounded-full bg-white/20 animate-ping group-hover:block hidden opacity-20 duration-1000"></div>
                    <MessageSquare size={26} className="relative z-10" />
                    {user && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white dark:border-zinc-900"></span>
                        </span>
                    )}
                </button>
            )}
        </div>
    );
}
