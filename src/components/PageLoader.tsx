import React from 'react';
import { Loader2 } from 'lucide-react';

interface PageLoaderProps {
    message?: string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({ message = '正在加载模块...' }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] w-full p-6 text-center animate-fade-in select-none">
            <div className="relative flex items-center justify-center mb-4">
                {/* Subtle pulsing background glow */}
                <div className="absolute w-14 h-14 rounded-full bg-emerald-500/10 animate-ping" />
                <div className="w-12 h-12 rounded-2xl bg-zinc-900/80 border border-zinc-700/60 shadow-xl flex items-center justify-center backdrop-blur-md">
                    <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                </div>
            </div>
            <p className="text-sm font-medium text-zinc-300 tracking-wide">{message}</p>
            <p className="text-xs text-zinc-500 mt-1">Packsecure OS · 极速按需加载中</p>
        </div>
    );
};

export default PageLoader;
