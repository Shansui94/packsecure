import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        {
            name: 'sop-assistant-api-dev-middleware',
            configureServer(server) {
                server.middlewares.use('/api/agent/sop-assistant', async (req, res, next) => {
                    if (req.method !== 'POST') return next();
                    let body = '';
                    req.on('data', chunk => { body += chunk; });
                    req.on('end', async () => {
                        try {
                            const parsedBody = JSON.parse(body || '{}');
                            const shimReq: any = req;
                            shimReq.body = parsedBody;

                            const shimRes: any = res;
                            shimRes.status = (code: number) => {
                                shimRes.statusCode = code;
                                return shimRes;
                            };
                            shimRes.json = (data: any) => {
                                shimRes.setHeader('Content-Type', 'application/json');
                                shimRes.end(JSON.stringify(data));
                                return shimRes;
                            };

                            const { default: handler } = await import('./api/agent/sop-assistant');
                            await handler(shimReq, shimRes);
                        } catch (err: any) {
                            console.error('[Vite SOP API Error]:', err);
                            res.statusCode = 500;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ success: false, error: err.message }));
                        }
                    });
                });
            }
        }
    ],
    server: {
        host: true, // Exposes to LAN (0.0.0.0)
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true
            }
        }
    }
})
