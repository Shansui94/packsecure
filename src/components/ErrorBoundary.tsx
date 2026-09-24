
import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    isChunkError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
        isChunkError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        const msg = String(error?.message || error?.name || error || '');
        const isChunkError =
            msg.includes('Failed to fetch dynamically imported module') ||
            msg.includes('error loading dynamically imported module') ||
            msg.includes('Importing a module script failed');

        if (isChunkError && typeof window !== 'undefined') {
            const lastReload = Number(sessionStorage.getItem('ps_chunk_reload_ts') || '0');
            const now = Date.now();
            // 15 秒内若未重载过，则自动执行一次平滑重载以拉取最新部署构建资源
            if (now - lastReload > 15000) {
                sessionStorage.setItem('ps_chunk_reload_ts', String(now));
                window.location.reload();
            }
        }

        return { hasError: true, error, errorInfo: null, isChunkError };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            // 💡 若为云端部署导致的旧版本 Chunk 404，呈现清晰友好的新版本载入提示，而非吓人的红屏崩溃
            if (this.state.isChunkError) {
                return (
                    <div className="min-h-screen bg-[#07070a] text-white flex flex-col items-center justify-center p-6 font-sans">
                        <div className="bg-[#0f0f17] border border-cyan-500/30 p-8 rounded-3xl max-w-lg w-full text-center shadow-2xl relative overflow-hidden">
                            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4 text-cyan-400">
                                <RefreshCw className="animate-spin" size={30} />
                            </div>
                            <h1 className="text-2xl font-black text-white mb-2">系统已检测到新版本发布</h1>
                            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                                云端已更新上线最新功能补丁。由于当前浏览器页面载入了上一版本的组件，点击下方按钮即可一键刷新载入最新系统。
                            </p>
                            <button
                                onClick={() => {
                                    sessionStorage.removeItem('ps_chunk_reload_ts');
                                    window.location.reload();
                                }}
                                className="w-full py-3.5 px-6 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                            >
                                <RefreshCw size={18} />
                                立即载入最新系统 (Update & Reload)
                            </button>
                        </div>
                    </div>
                );
            }

            return (
                <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8 font-mono">
                    <div className="bg-red-900/20 border border-red-500/50 p-8 rounded-2xl max-w-4xl w-full">
                        <div className="flex items-center gap-4 mb-6">
                            <AlertTriangle className="text-red-500" size={48} />
                            <div>
                                <h1 className="text-3xl font-bold text-red-500">SYSTEM CRITICAL FAILURE (v7.0)</h1>
                                <p className="text-red-300">Feature restoration complete. Please confirm verification.</p>
                            </div>
                        </div>

                        <div className="bg-black/50 p-6 rounded-xl overflow-auto max-h-[60vh] text-sm text-red-200 border border-red-500/10">
                            <h3 className="text-lg font-bold mb-2 text-white">{this.state.error?.toString()}</h3>
                            <pre className="whitespace-pre-wrap opacity-70">
                                {this.state.errorInfo?.componentStack}
                            </pre>
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            className="mt-6 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all"
                        >
                            ATTEMPT SYSTEM REBOOT
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
