import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// React DOM reconciliation crash shield (Google Translate / DOM modification bugfix)
if (typeof window !== 'undefined' && typeof Node !== 'undefined' && Node.prototype) {
    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function <T extends Node>(child: T): T {
        if (child && child.parentNode !== this) {
            console.warn('Node.removeChild: child is not a child of this node', child, this);
            if (child.parentNode) {
                return originalRemoveChild.call(child.parentNode, child) as T;
            }
            return child;
        }
        return originalRemoveChild.apply(this, arguments as any) as T;
    };

    const originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
        if (referenceNode && referenceNode.parentNode !== this) {
            console.warn('Node.insertBefore: referenceNode is not a child of this node', referenceNode, this);
            return originalInsertBefore.call(referenceNode.parentNode || this, newNode, referenceNode) as T;
        }
        return originalInsertBefore.apply(this, arguments as any) as T;
    };
}
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

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
