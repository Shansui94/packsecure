import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, X, Loader } from 'lucide-react';
import { useAICommand } from '../hooks/useAICommand';

interface AIChatWidgetProps {
    contextData: any;
    onAction: (action: any) => void;
}

export const AIChatWidget: React.FC<AIChatWidgetProps> = ({ contextData, onAction }: AIChatWidgetProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Initialize Hook
    const { executeCommand, loading } = useAICommand();

    // Scroll to bottom
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || loading) return;

        const userText = query;
        setQuery('');
        setMessages(prev => [...prev, { role: 'user', text: userText }]);

        try {
            // Simplified context to save tokens (send only schema/headers or first 5 rows)
            const slimContext = {
                tab: contextData.activeTab,
                sample: contextData.data.slice(0, 5) // Only send first 5 items as sample
            };

            const action = await executeCommand(userText, slimContext);

            // Handle Response
            if (action.type === 'ANALYZE') {
                setMessages(prev => [...prev, { role: 'ai', text: action.payload.summary }]);
            } else if (action.type === 'UNKNOWN') {
                setMessages(prev => [...prev, { role: 'ai', text: "I'm not sure how to help with that yet." }]);
            } else {
                setMessages(prev => [...prev, { role: 'ai', text: `Executing: ${action.reasoning}` }]);
                onAction(action);
            }

        } catch (err: any) {
            setMessages(prev => [...prev, { role: 'ai', text: `Error: ${err.message}` }]);
        }
    };

    return (
        <>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 p-4 rounded-full shadow-2xl z-50 transition-all active:scale-95 ${isOpen ? 'bg-red-500 rotate-90' : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:scale-110'
                    }`}
            >
                {isOpen ? <X text-white /> : <Sparkles className="text-white animate-pulse" />}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-[#121215] border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-10 fade-in">
                    {/* Header */}
                    <div className="p-4 bg-white/5 border-b border-white/5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                            <Sparkles size={16} className="text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-sm">JARVIS AI</h3>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Online</span>
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {messages.length === 0 && (
                            <div className="text-center mt-20 text-gray-600 text-sm">
                                <p>Hello, Commander.</p>
                                <p>How can I assist with your data today?</p>
                            </div>
                        )}
                        {messages.map((m, idx) => (
                            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${m.role === 'user'
                                    ? 'bg-indigo-600 text-white rounded-br-none'
                                    : 'bg-white/10 text-gray-200 rounded-bl-none'
                                    }`}>
                                    {m.text}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white/5 p-3 rounded-2xl rounded-bl-none flex gap-2 items-center">
                                    <Loader size={12} className="animate-spin text-indigo-400" />
                                    <span className="text-xs text-gray-500">Processing...</span>
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSubmit} className="p-4 bg-white/5 border-t border-white/5">
                        <div className="relative">
                            <input
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Command JARVIS..."
                                className="w-full bg-[#09090b] border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all placeholder-gray-600"
                            />
                            <button
                                type="submit"
                                disabled={loading || !query.trim()}
                                className="absolute right-2 top-2 p-1.5 bg-indigo-600 rounded-lg text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
};
