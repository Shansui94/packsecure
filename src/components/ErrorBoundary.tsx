
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8 font-mono">
                    <div className="bg-red-900/20 border border-red-500/50 p-8 rounded-2xl max-w-4xl w-full">
                        <div className="flex items-center gap-4 mb-6">
                            <AlertTriangle className="text-red-500" size={48} />
                            <div>
                                <h1 className="text-3xl font-bold text-red-500">SYSTEM CRITICAL FAILURE (v5.6)</h1>
                                <p className="text-red-300">New feature is missing implementation. Fixed in this version.</p>
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
