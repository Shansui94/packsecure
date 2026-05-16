import type { VercelRequest, VercelResponse } from '@vercel/node';

function isAllowedOrigin(origin: string): boolean {
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return true;
    }
    if (origin.endsWith('.vercel.app')) {
        return true;
    }
    const site = process.env.SITE_URL || process.env.VITE_SITE_URL;
    if (site && origin === site) {
        return true;
    }
    return false;
}

/** Reflect origin for browser calls from the app; omit header for non-browser requests. */
export function applyAdminCors(req: VercelRequest, res: VercelResponse): void {
    const origin = req.headers.origin;
    if (typeof origin === 'string' && isAllowedOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
