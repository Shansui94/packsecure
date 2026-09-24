import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// React DOM reconciliation crash shield (Google Translate / DOM modification bugfix)
if (typeof window !== 'undefined' && typeof Node !== 'undefined' && Node.prototype) {
    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function <T extends Node>(child: T): T {
        try {
            if (child && child.parentNode !== this) {
                console.warn('Node.removeChild: child is not a child of this node', child, this);
                if (child.parentNode) {
                    try {
                        return originalRemoveChild.call(child.parentNode, child) as T;
                    } catch (e) {
                        return child;
                    }
                }
                return child;
            }
            return originalRemoveChild.apply(this, arguments as any) as T;
        } catch (e) {
            console.warn('Node.removeChild: caught exception', e);
            return child;
        }
    };

    const originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
        try {
            if (referenceNode && referenceNode.parentNode !== this) {
                console.warn('Node.insertBefore: referenceNode is not a child of this node', referenceNode, this);
                if (referenceNode.parentNode) {
                    try {
                        return originalInsertBefore.call(referenceNode.parentNode, newNode, referenceNode) as T;
                    } catch (e) {
                        return originalInsertBefore.call(this, newNode, null) as T;
                    }
                }
                return originalInsertBefore.call(this, newNode, null) as T;
            }
            return originalInsertBefore.apply(this, arguments as any) as T;
        } catch (e) {
            console.warn('Node.insertBefore: caught exception', e);
            try {
                return originalInsertBefore.call(this, newNode, null) as T;
            } catch (innerErr) {
                return newNode;
            }
        }
    };
}
import './index.css';
import './utils/i18n';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

// 🔒 自动捕获 Vite 代码分割 Chunk 404 (新版本发布部署后的自动无缝刷新)
if (typeof window !== 'undefined') {
    window.addEventListener('vite:preloadError', (event) => {
        console.warn('Vite preload error detected, reloading to fetch latest app assets...', event);
        const lastReload = Number(sessionStorage.getItem('ps_chunk_reload_ts') || '0');
        const now = Date.now();
        if (now - lastReload > 10000) {
            sessionStorage.setItem('ps_chunk_reload_ts', String(now));
            window.location.reload();
        }
    });
}

const rootElement = document.getElementById('root');
if (rootElement) {
    createRoot(rootElement).render(
        <StrictMode>
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        </StrictMode>,
    );
}
